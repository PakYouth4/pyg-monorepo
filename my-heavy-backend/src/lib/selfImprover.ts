/**
 * selfImprover.ts
 * Meta-AI module that analyzes workflow failures and suggests improvements
 * 
 * This module:
 * 1. Analyzes patterns in failures
 * 2. Suggests code improvements or new functions
 * 3. Logs suggestions to Firestore for human review
 */

import { callLLM, TaskType } from './llmProvider';
import { db } from './firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { StepEvaluation, StepLog } from './orchestrator';

// ============ TYPES ============

export interface ImprovementSuggestion {
    id: string;
    timestamp: number;
    stepName: string;
    failurePattern: string;
    suggestionType: 'new_function' | 'code_change' | 'process_change' | 'new_api' | 'config_change';
    title: string;
    description: string;
    codeSnippet?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedImpact: string;
    status: 'pending' | 'reviewed' | 'implemented' | 'rejected';
}

export interface FailureAnalysis {
    stepName: string;
    failureCount: number;
    commonIssues: string[];
    lastFailure: number;
    successRate: number;
}

// ============ FAILURE PATTERN DETECTION ============

const FAILURE_THRESHOLD = 3; // Analyze after N failures

// Track failures in memory (would normally use Redis/DB)
const failureTracker: Map<string, FailureAnalysis> = new Map();

export function recordFailure(stepName: string, evaluation: StepEvaluation): void {
    const existing = failureTracker.get(stepName) || {
        stepName,
        failureCount: 0,
        commonIssues: [],
        lastFailure: 0,
        successRate: 100
    };

    existing.failureCount++;
    existing.lastFailure = Date.now();

    if (evaluation.issue && !existing.commonIssues.includes(evaluation.issue)) {
        existing.commonIssues.push(evaluation.issue);
    }

    failureTracker.set(stepName, existing);
}

export function recordSuccess(stepName: string): void {
    const existing = failureTracker.get(stepName);
    if (existing) {
        // Recalculate success rate
        const total = existing.failureCount + 1;
        existing.successRate = (1 / total) * 100;
    }
}

export function shouldAnalyze(stepName: string): boolean {
    const analysis = failureTracker.get(stepName);
    return analysis ? analysis.failureCount >= FAILURE_THRESHOLD : false;
}

// ============ AI IMPROVEMENT ANALYZER ============

export async function analyzeAndSuggest(
    stepName: string,
    recentLogs: StepLog[],
    evaluation: StepEvaluation
): Promise<ImprovementSuggestion | null> {
    const analysis = failureTracker.get(stepName);
    if (!analysis) return null;

    const prompt = `You are a senior software engineer analyzing a failing step in a research workflow.

STEP: ${stepName}
FAILURE COUNT: ${analysis.failureCount}
COMMON ISSUES: ${analysis.commonIssues.join(', ')}
SUCCESS RATE: ${analysis.successRate.toFixed(1)}%
LATEST ISSUE: ${evaluation.issue}
METRICS: ${JSON.stringify(evaluation.metrics || {})}

RECENT LOGS:
${recentLogs.slice(-5).map(l => `[${l.type}] ${l.message}`).join('\n')}

Analyze why this step keeps failing and suggest ONE specific improvement.

Respond with JSON:
{
    "failurePattern": "Brief description of the root cause pattern",
    "suggestionType": "new_function" | "code_change" | "process_change" | "new_api" | "config_change",
    "title": "Short title for the improvement",
    "description": "Detailed description of what should be changed",
    "codeSnippet": "If applicable, example TypeScript code for the fix (or null)",
    "priority": "low" | "medium" | "high" | "critical",
    "estimatedImpact": "Expected improvement if implemented"
}`;

    try {
        const response = await callLLM({
            task: 'KEYWORDS' as TaskType,
            messages: [
                { role: 'system', content: 'You are a code improvement assistant. Analyze failures and suggest actionable improvements. Return only valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.4,
            jsonMode: true
        });

        const parsed = JSON.parse(response);

        const suggestion: ImprovementSuggestion = {
            id: `sugg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            stepName,
            failurePattern: parsed.failurePattern,
            suggestionType: parsed.suggestionType,
            title: parsed.title,
            description: parsed.description,
            codeSnippet: parsed.codeSnippet || undefined,
            priority: parsed.priority,
            estimatedImpact: parsed.estimatedImpact,
            status: 'pending'
        };

        return suggestion;
    } catch (e) {
        console.error('[SelfImprover] Analysis failed:', e);
        return null;
    }
}

// ============ SUGGESTION STORAGE ============

export async function saveSuggestion(suggestion: ImprovementSuggestion): Promise<void> {
    try {
        // Save to a dedicated collection
        await db.collection('ai_suggestions').doc(suggestion.id).set(suggestion);

        console.log(`[SelfImprover] ✨ Saved suggestion: ${suggestion.title}`);
    } catch (e) {
        console.error('[SelfImprover] Failed to save suggestion:', e);
    }
}

export async function logSuggestionToReport(
    reportId: string,
    suggestion: ImprovementSuggestion
): Promise<void> {
    try {
        await db.collection('reports').doc(reportId).update({
            aiSuggestions: FieldValue.arrayUnion({
                id: suggestion.id,
                timestamp: suggestion.timestamp,
                title: suggestion.title,
                type: suggestion.suggestionType,
                priority: suggestion.priority
            })
        });
    } catch (e) {
        console.error('[SelfImprover] Failed to log suggestion to report:', e);
    }
}

// ============ MAIN INTERFACE ============

export class SelfImprover {
    private reportId: string;
    private logs: StepLog[] = [];

    constructor(reportId: string) {
        this.reportId = reportId;
    }

    recordLog(log: StepLog): void {
        this.logs.push(log);
    }

    async onStepComplete(
        stepName: string,
        success: boolean,
        evaluation: StepEvaluation
    ): Promise<ImprovementSuggestion | null> {
        if (success) {
            recordSuccess(stepName);
            return null;
        }

        // Record failure
        recordFailure(stepName, evaluation);

        // Check if we should analyze
        if (!shouldAnalyze(stepName)) {
            return null;
        }

        console.log(`[SelfImprover] 🔍 Analyzing repeated failures for: ${stepName}`);

        // Generate suggestion
        const suggestion = await analyzeAndSuggest(stepName, this.logs, evaluation);

        if (suggestion) {
            // Save to global suggestions collection
            await saveSuggestion(suggestion);

            // Also log to this report
            await logSuggestionToReport(this.reportId, suggestion);

            console.log(`[SelfImprover] 💡 Generated suggestion: ${suggestion.title}`);
        }

        return suggestion;
    }

    async generateWorkflowSummary(): Promise<string> {
        const allAnalyses = Array.from(failureTracker.values());

        if (allAnalyses.length === 0) {
            return 'No failures recorded in this session.';
        }

        const prompt = `Based on these workflow step analyses, provide a brief summary of system health and top improvements needed:

${allAnalyses.map(a =>
            `- ${a.stepName}: ${a.failureCount} failures, ${a.successRate.toFixed(0)}% success, issues: ${a.commonIssues.join('; ')}`
        ).join('\n')}

Respond with a 2-3 sentence summary.`;

        try {
            const response = await callLLM({
                task: 'KEYWORDS' as TaskType,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3
            });
            return response;
        } catch {
            return 'Unable to generate summary.';
        }
    }
}

// ============ FACTORY ============

export function createSelfImprover(reportId: string): SelfImprover {
    return new SelfImprover(reportId);
}
