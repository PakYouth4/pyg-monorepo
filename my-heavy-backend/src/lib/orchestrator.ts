/**
 * orchestrator.ts
 * AI-powered workflow orchestrator with step evaluation, smart retries, and logging
 */

import { callLLM, TaskType } from './llmProvider';
import { db } from './firebase';
import { FieldValue } from 'firebase-admin/firestore';

// ============ TYPES ============

export type StepQuality = 'good' | 'partial' | 'empty' | 'error';
export type AIDecision = 'continue' | 'retry' | 'skip' | 'fallback';

export interface StepLog {
    timestamp: number;
    step: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'ai_decision';
    data?: Record<string, unknown>;
}

export interface StepEvaluation {
    quality: StepQuality;
    issue?: string;
    metrics?: Record<string, number | string>;
}

export interface AIEvaluation {
    decision: AIDecision;
    reason: string;
    modifiedInput?: Record<string, unknown>;
}

export interface StepResult<T = unknown> {
    success: boolean;
    data: T;
    evaluation: StepEvaluation;
    aiDecision?: AIEvaluation;
    retryCount: number;
}

export interface StepConfig<T = unknown> {
    name: string;
    execute: (input?: Record<string, unknown>) => Promise<T>;
    evaluate: (result: T) => StepEvaluation;
    retryStrategy?: 'broader_query' | 'different_source' | 'skip' | 'none';
    maxRetries?: number;
    canSkip?: boolean;
    fallback?: () => Promise<T>;
}

export interface OrchestratorConfig {
    reportId: string;
    topic: string;
    enableAIDecisions?: boolean;
    verbose?: boolean;
}

// ============ ORCHESTRATOR CLASS ============

export class WorkflowOrchestrator {
    private reportId: string;
    private topic: string;
    private enableAI: boolean;
    private verbose: boolean;
    private stepHistory: StepLog[] = [];

    constructor(config: OrchestratorConfig) {
        this.reportId = config.reportId;
        this.topic = config.topic;
        this.enableAI = config.enableAIDecisions ?? true;
        this.verbose = config.verbose ?? true;
    }

    // ============ LOGGING ============

    async log(step: string, message: string, type: StepLog['type'] = 'info', data?: Record<string, unknown>): Promise<void> {
        const logEntry: StepLog = {
            timestamp: Date.now(),
            step,
            message,
            type,
            ...(data ? { data } : {})
        };

        this.stepHistory.push(logEntry);

        if (this.verbose) {
            const prefix = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', ai_decision: '🤖' }[type];
            console.log(`[Orchestrator] ${prefix} [${step}] ${message}`);
        }

        // Save to Firestore
        try {
            await db.collection('reports').doc(this.reportId).update({
                orchestratorLogs: FieldValue.arrayUnion(logEntry)
            });
        } catch (e) {
            console.error('[Orchestrator] Failed to save log to Firestore:', e);
        }
    }

    // ============ AI EVALUATION ============

    private async getAIDecision(
        stepName: string,
        evaluation: StepEvaluation,
        retryStrategy: StepConfig['retryStrategy'],
        currentRetry: number,
        maxRetries: number
    ): Promise<AIEvaluation> {
        if (!this.enableAI || evaluation.quality === 'good') {
            return { decision: 'continue', reason: 'Result quality is good' };
        }

        // Default decisions based on quality
        if (evaluation.quality === 'error') {
            if (currentRetry < maxRetries) {
                return { decision: 'retry', reason: `Error occurred, retrying (${currentRetry + 1}/${maxRetries})` };
            }
            return { decision: 'skip', reason: 'Max retries reached after errors' };
        }

        if (evaluation.quality === 'empty') {
            if (currentRetry < maxRetries && retryStrategy !== 'none') {
                // Use AI to suggest modified approach
                try {
                    const aiResponse = await callLLM({
                        task: 'KEYWORDS' as TaskType, // Use lightweight model
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a workflow optimizer. Analyze step results and suggest improvements. Return ONLY valid JSON.'
                            },
                            {
                                role: 'user',
                                content: `
STEP: ${stepName}
TOPIC: ${this.topic}
RESULT QUALITY: ${evaluation.quality}
ISSUE: ${evaluation.issue || 'Empty result'}
METRICS: ${JSON.stringify(evaluation.metrics || {})}
RETRY STRATEGY AVAILABLE: ${retryStrategy}
CURRENT RETRY: ${currentRetry}/${maxRetries}

Analyze and respond with JSON:
{
    "decision": "retry" | "skip" | "fallback",
    "reason": "Brief explanation",
    "modification": "If retry, what should change? e.g., 'broaden search query'"
}
`
                            }
                        ],
                        temperature: 0.3,
                        jsonMode: true
                    });

                    const parsed = JSON.parse(aiResponse);
                    return {
                        decision: parsed.decision || 'skip',
                        reason: parsed.reason || 'AI suggested skipping',
                        modifiedInput: parsed.modification ? { modification: parsed.modification } : undefined
                    };
                } catch (e) {
                    console.warn('[Orchestrator] AI decision failed, using default:', e);
                }
            }
            return { decision: 'skip', reason: 'Empty result, skipping step' };
        }

        // Partial quality - continue but warn
        return { decision: 'continue', reason: `Partial result: ${evaluation.issue || 'Some data missing'}` };
    }

    // ============ MAIN STEP RUNNER ============

    async runStep<T>(config: StepConfig<T>): Promise<StepResult<T>> {
        const { name, execute, evaluate, retryStrategy = 'none', maxRetries = 2, canSkip = true, fallback } = config;
        let retryCount = 0;
        let lastEvaluation: StepEvaluation = { quality: 'error', issue: 'Not executed' };
        let lastData: T | null = null;

        await this.log(name, `Starting step: ${name}`, 'info');

        while (retryCount <= maxRetries) {
            try {
                // Execute the step
                const startTime = Date.now();
                const result = await execute();
                const duration = Date.now() - startTime;

                // Evaluate the result
                lastEvaluation = evaluate(result);
                lastData = result;

                await this.log(name, `Completed in ${duration}ms`, 'info', {
                    quality: lastEvaluation.quality,
                    metrics: lastEvaluation.metrics
                });

                // Get AI decision
                const aiDecision = await this.getAIDecision(
                    name,
                    lastEvaluation,
                    retryStrategy,
                    retryCount,
                    maxRetries
                );

                if (aiDecision.decision !== 'continue' || lastEvaluation.quality !== 'good') {
                    await this.log(name, `${aiDecision.reason}`, 'ai_decision', {
                        decision: aiDecision.decision,
                        quality: lastEvaluation.quality
                    });
                }

                // Handle AI decision
                if (aiDecision.decision === 'continue') {
                    return {
                        success: true,
                        data: result,
                        evaluation: lastEvaluation,
                        aiDecision,
                        retryCount
                    };
                }

                if (aiDecision.decision === 'retry') {
                    retryCount++;
                    await this.log(name, `Retrying (${retryCount}/${maxRetries})...`, 'warning');
                    continue;
                }

                if (aiDecision.decision === 'fallback' && fallback) {
                    await this.log(name, 'Using fallback strategy', 'warning');
                    const fallbackResult = await fallback();
                    return {
                        success: true,
                        data: fallbackResult,
                        evaluation: { quality: 'partial', issue: 'Used fallback' },
                        aiDecision,
                        retryCount
                    };
                }

                // Skip
                if (canSkip) {
                    await this.log(name, `Skipping step: ${aiDecision.reason}`, 'warning');
                    return {
                        success: false,
                        data: result,
                        evaluation: lastEvaluation,
                        aiDecision,
                        retryCount
                    };
                }

                throw new Error(`Step ${name} cannot be skipped and failed`);

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                await this.log(name, `Error: ${errorMsg}`, 'error');

                lastEvaluation = { quality: 'error', issue: errorMsg };

                if (retryCount < maxRetries) {
                    retryCount++;
                    await this.log(name, `Retrying after error (${retryCount}/${maxRetries})...`, 'warning');
                    continue;
                }

                if (canSkip) {
                    await this.log(name, 'Max retries reached, skipping step', 'error');
                    return {
                        success: false,
                        data: null as T,
                        evaluation: lastEvaluation,
                        aiDecision: { decision: 'skip', reason: 'Max retries after errors' },
                        retryCount
                    };
                }

                throw error;
            }
        }

        // Should not reach here, but safety return
        return {
            success: false,
            data: lastData as T,
            evaluation: lastEvaluation,
            retryCount
        };
    }

    // ============ UTILITY METHODS ============

    getHistory(): StepLog[] {
        return this.stepHistory;
    }

    async finalize(success: boolean): Promise<void> {
        await this.log('workflow', success ? 'Workflow completed successfully' : 'Workflow completed with issues', success ? 'success' : 'warning');
    }
}

// ============ FACTORY ============

export function createOrchestrator(config: OrchestratorConfig): WorkflowOrchestrator {
    return new WorkflowOrchestrator(config);
}
