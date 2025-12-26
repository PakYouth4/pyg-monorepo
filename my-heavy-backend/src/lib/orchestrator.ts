/**
 * orchestrator.ts
 * AI-powered workflow orchestrator with step evaluation, smart retries, and logging
 * ENHANCED: Alternative functions, step re-execution, AI strategy selection
 */

import { callLLM, TaskType } from './llmProvider';
import { db } from './firebase';
import { FieldValue } from 'firebase-admin/firestore';
import {
    getRetryStrategy,
    getStepRetryConfig,
    StrategyType,
    RetryContext,
    getAIStrategyPrompt,
    getNextAlternativeFunction
} from './retryStrategies';
import { createSelfImprover, SelfImprover, ImprovementSuggestion } from './selfImprover';

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
    alternativeFunction?: string;
    rerunStep?: string;
    strategyUsed?: string;
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
    retryStrategy?: StrategyType;
    maxRetries?: number;
    canSkip?: boolean;
    fallback?: () => Promise<T>;
}

export interface OrchestratorConfig {
    reportId: string;
    topic: string;
    enableAIDecisions?: boolean;
    enableSelfImprovement?: boolean;
    verbose?: boolean;
}

// ============ ORCHESTRATOR CLASS ============

export class WorkflowOrchestrator {
    private reportId: string;
    private topic: string;
    private enableAI: boolean;
    private verbose: boolean;
    private stepHistory: StepLog[] = [];
    private selfImprover: SelfImprover | null = null;
    private suggestions: ImprovementSuggestion[] = [];

    constructor(config: OrchestratorConfig) {
        this.reportId = config.reportId;
        this.topic = config.topic;
        this.enableAI = config.enableAIDecisions ?? true;
        this.verbose = config.verbose ?? true;

        // Initialize self-improver if enabled
        if (config.enableSelfImprovement ?? true) {
            this.selfImprover = createSelfImprover(config.reportId);
        }
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
        // Good quality = continue
        if (evaluation.quality === 'good') {
            return { decision: 'continue', reason: 'Result quality is good' };
        }

        // Get step-specific retry config
        const stepConfig = getStepRetryConfig(stepName);
        const effectiveStrategy = (retryStrategy || stepConfig.strategy) as StrategyType;
        const effectiveMaxRetries = Math.max(maxRetries, stepConfig.maxRetries);

        // Create retry context
        const retryContext: RetryContext = {
            stepName,
            topic: this.topic,
            evaluation,
            retryCount: currentRetry,
            maxRetries: effectiveMaxRetries
        };

        // Error quality - always try to retry first
        if (evaluation.quality === 'error') {
            if (currentRetry < effectiveMaxRetries) {
                const strategyResult = getRetryStrategy(effectiveStrategy, retryContext);
                return {
                    decision: 'retry',
                    reason: `Error: ${evaluation.issue}. ${strategyResult.reason}`,
                    modifiedInput: strategyResult.modifiedInput
                };
            }
            return {
                decision: stepConfig.canSkip ? 'skip' : 'continue',
                reason: `Max retries (${effectiveMaxRetries}) reached after errors. ${stepConfig.canSkip ? 'Skipping step.' : 'Continuing anyway.'}`
            };
        }

        // Empty quality - use retry strategies with AI enhancement
        if (evaluation.quality === 'empty') {
            if (currentRetry < effectiveMaxRetries && effectiveStrategy !== 'none') {
                // Get strategy-based modification
                const strategyResult = getRetryStrategy(effectiveStrategy, retryContext);

                // Optionally enhance with AI reasoning (if enabled and first retry)
                if (this.enableAI && currentRetry === 0) {
                    try {
                        const aiResponse = await callLLM({
                            task: 'KEYWORDS' as TaskType,
                            messages: [
                                {
                                    role: 'system',
                                    content: `You are a workflow optimizer. Analyze why step "${stepName}" returned empty results and suggest a specific fix. Be concise.`
                                },
                                {
                                    role: 'user',
                                    content: `
STEP: ${stepName}
TOPIC: ${this.topic}
ISSUE: ${evaluation.issue || 'Empty result'}
METRICS: ${JSON.stringify(evaluation.metrics || {})}
SUGGESTED STRATEGY: ${strategyResult.reason}

Respond with JSON:
{
    "analysis": "One sentence explaining why this might have failed",
    "suggestion": "One specific actionable suggestion"
}
`
                                }
                            ],
                            temperature: 0.2,
                            jsonMode: true
                        });

                        const parsed = JSON.parse(aiResponse);
                        return {
                            decision: 'retry',
                            reason: `${parsed.analysis} → ${parsed.suggestion}`,
                            modifiedInput: {
                                ...strategyResult.modifiedInput,
                                aiSuggestion: parsed.suggestion
                            }
                        };
                    } catch (e) {
                        console.warn('[Orchestrator] AI enhancement failed, using strategy default:', e);
                    }
                }

                // Fallback to strategy-only decision
                return {
                    decision: strategyResult.shouldRetry ? 'retry' : 'skip',
                    reason: strategyResult.reason,
                    modifiedInput: strategyResult.modifiedInput
                };
            }

            // Max retries reached for empty result
            return {
                decision: stepConfig.canSkip ? 'skip' : 'continue',
                reason: `Empty result after ${currentRetry} retries. ${stepConfig.canSkip ? 'Skipping step.' : 'Continuing with empty data.'}`
            };
        }

        // Partial quality - continue but log the issue
        return {
            decision: 'continue',
            reason: `Partial result accepted: ${evaluation.issue || 'Some data missing, but sufficient to continue'}`
        };
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
                    await this.log(name, `🤖 ${aiDecision.reason}`, 'ai_decision', {
                        decision: aiDecision.decision,
                        quality: lastEvaluation.quality,
                        retryCount,
                        maxRetries,
                        modifiedInput: aiDecision.modifiedInput,
                        metrics: lastEvaluation.metrics
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
                    const modificationInfo = aiDecision.modifiedInput
                        ? ` with modifications: ${JSON.stringify(aiDecision.modifiedInput)}`
                        : '';
                    await this.log(name, `⟳ Retrying (${retryCount}/${maxRetries})${modificationInfo}`, 'warning', {
                        retryCount,
                        maxRetries,
                        modifiedInput: aiDecision.modifiedInput
                    });
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

    getSuggestions(): ImprovementSuggestion[] {
        return this.suggestions;
    }

    // Called after each step to trigger self-improvement analysis
    async analyzeStep(stepName: string, success: boolean, evaluation: StepEvaluation): Promise<void> {
        if (!this.selfImprover) return;

        // Record log to self-improver
        this.stepHistory.forEach(log => this.selfImprover!.recordLog(log));

        // Analyze and potentially generate suggestion
        const suggestion = await this.selfImprover.onStepComplete(stepName, success, evaluation);

        if (suggestion) {
            this.suggestions.push(suggestion);
            await this.log(stepName, `💡 AI Suggestion: ${suggestion.title}`, 'ai_decision', {
                suggestionId: suggestion.id,
                suggestionType: suggestion.suggestionType,
                priority: suggestion.priority,
                description: suggestion.description.substring(0, 200)
            });
        }
    }

    async finalize(success: boolean): Promise<void> {
        await this.log('workflow', success ? 'Workflow completed successfully' : 'Workflow completed with issues', success ? 'success' : 'warning');

        // Generate and log workflow summary if self-improver is enabled
        if (this.selfImprover) {
            const summary = await this.selfImprover.generateWorkflowSummary();
            await this.log('self_improvement', `System Health: ${summary}`, 'info');

            // Log all suggestions
            if (this.suggestions.length > 0) {
                await this.log('self_improvement', `Generated ${this.suggestions.length} improvement suggestion(s)`, 'ai_decision', {
                    suggestions: this.suggestions.map(s => ({
                        id: s.id,
                        title: s.title,
                        type: s.suggestionType,
                        priority: s.priority
                    }))
                });
            }
        }
    }
}

// ============ FACTORY ============

export function createOrchestrator(config: OrchestratorConfig): WorkflowOrchestrator {
    return new WorkflowOrchestrator(config);
}
