/**
 * pipelineLogger.ts
 * Refined Pipeline Logging System
 * 
 * Addresses:
 * 1. Concurrency - Steps tracked by unique IDs in Map, not global currentStep
 * 2. Memory Bloat - Data sanitized with strict size limits
 * 3. Error Serialization - Errors explicitly extracted
 * 
 * Designed for parallel step execution (Step 5 summarization, etc.)
 */

import { randomUUID } from 'crypto';

// ============ TYPE DEFINITIONS ============

export interface ModelAttempt {
    order: number;
    provider: 'groq' | 'openrouter';
    model: string;
    status: 'success' | 'failed';
    startedAt: string;
    duration: number;
    // Success data
    tokensIn?: number;
    tokensOut?: number;
    responsePreview?: string;  // Truncated response
    // Failure data
    error?: {
        type: string;
        code: string;
        message: string;
        raw?: string;        // Truncated to 1000 chars
    };
}

export interface DataSnapshot {
    preview: string;         // First 500 chars (safe for UI polling)
    type: string;            // "string" | "array" | "object"
    size: number;            // Original size
    isTruncated: boolean;
    itemCount?: number;      // For arrays
}

export interface StepLog {
    id: string;              // Unique: "step_5_a1b2c3d4"
    parentId?: string;       // For parallel child steps
    name: string;            // "Summarize: BBC Article"
    order: number;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    modelAttempts: ModelAttempt[];
    input: DataSnapshot;
    output: DataSnapshot;
    error?: {
        message: string;
        code?: string;
        stack?: string;
    };
    meta: Record<string, any>;
}

export interface PipelineSummary {
    totalDuration: number;
    totalTokens: number;
    modelsUsed: string[];
    modelsSucceeded: string[];
    modelsFailed: string[];
    errorsCount: number;
    stepsCompleted: number;
    stepsFailed: number;
    stepsRunning: number;
}

export interface PipelineRun {
    id: string;
    topic: string;
    startedAt: string;
    completedAt?: string;
    status: 'running' | 'completed' | 'failed';
    currentStepName?: string;  // For display only, not used for tracking
    steps: StepLog[];
    summary: PipelineSummary;
}

// Lite versions for frequent polling (reduced data)
export interface LiteStepLog {
    id: string;
    parentId?: string;
    name: string;
    order: number;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    duration?: number;
    modelAttemptCount: number;  // Just the count, not full array
    hasError: boolean;
}

export interface LitePipelineRun {
    id: string;
    topic: string;
    status: 'running' | 'completed' | 'failed';
    startedAt: string;
    completedAt?: string;
    currentStepName?: string;
    summary: PipelineSummary;
    steps: LiteStepLog[];
}

// ============ STEP REGISTRY (Config-Driven) ============

export interface StepDefinition {
    name: string;
    order: number;
    type: 'ai' | 'api' | 'transform';
    description: string;
    canParallelize: boolean;
}

export const STEP_REGISTRY: Record<string, StepDefinition> = {
    step1_keywords: {
        name: "Keywords Generation",
        order: 1,
        type: "ai",
        description: "Generate 10 search keywords from topic",
        canParallelize: false
    },
    step2_search: {
        name: "Tavily Search",
        order: 2,
        type: "api",
        description: "Search for articles using keywords",
        canParallelize: false
    },
    step3_scrape: {
        name: "Article Scraping",
        order: 3,
        type: "api",
        description: "Scrape content from URLs via Firecrawl",
        canParallelize: false
    },
    step4_structure: {
        name: "Content Structuring",
        order: 4,
        type: "ai",
        description: "Extract structured data from articles",
        canParallelize: true  // Runs per article
    },
    step5_summarize: {
        name: "Article Summarization",
        order: 5,
        type: "ai",
        description: "Create summaries - RUNS IN PARALLEL",
        canParallelize: true
    },
    step6_queries: {
        name: "Video Query Generation",
        order: 6,
        type: "ai",
        description: "Generate YouTube search queries",
        canParallelize: false
    },
    step7_videos: {
        name: "YouTube Search",
        order: 7,
        type: "api",
        description: "Search for relevant videos",
        canParallelize: false
    },
    step8_transcribe: {
        name: "Video Transcription",
        order: 8,
        type: "api",
        description: "Extract video captions",
        canParallelize: true
    },
    step9_merge: {
        name: "Knowledge Base Merge",
        order: 9,
        type: "ai",
        description: "Merge articles and videos",
        canParallelize: false
    },
    step10_normalize: {
        name: "Source Normalization",
        order: 10,
        type: "transform",
        description: "Standardize to canonical format",
        canParallelize: false
    },
    step11_analyze: {
        name: "Deep Analysis",
        order: 11,
        type: "ai",
        description: "5-stage deep analysis - RUNS SEQUENTIALLY",
        canParallelize: false
    },
    step12_content: {
        name: "Content Ideas",
        order: 12,
        type: "ai",
        description: "Generate social media content",
        canParallelize: true
    },
    step13_report: {
        name: "Report Assembly",
        order: 13,
        type: "transform",
        description: "Assemble final report",
        canParallelize: false
    }
};

// ============ PIPELINE LOGGER CLASS ============

const MAX_PREVIEW_LENGTH = 500;
const MAX_RAW_ERROR_LENGTH = 1000;
const MAX_FULL_DATA_SIZE = 50000;  // 50KB limit for storing full data

// API key patterns to redact from logs (prevent credential leaks)
const SENSITIVE_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/g,         // OpenAI keys
    /gsk_[a-zA-Z0-9]{20,}/g,        // Groq keys
    /AIza[a-zA-Z0-9_-]{35}/g,       // Google API keys
    /[a-zA-Z0-9]{32,}/g,            // Generic long tokens (be careful)
];

function redactSensitiveData(str: string): string {
    let result = str;
    // Only redact obvious API key patterns, not all long strings
    result = result.replace(/sk-[a-zA-Z0-9]{20,}/g, '[OPENAI_KEY]');
    result = result.replace(/gsk_[a-zA-Z0-9]{20,}/g, '[GROQ_KEY]');
    result = result.replace(/or-[a-zA-Z0-9]{20,}/g, '[OPENROUTER_KEY]');
    return result;
}

export class PipelineLogger {
    private runId: string;
    private topic: string;
    private logs: PipelineRun;

    // Active steps map - allows concurrent updates without race conditions
    private activeSteps = new Map<string, StepLog>();

    // Model attempt counter per step
    private modelAttemptCounters = new Map<string, number>();

    constructor(runId: string, topic: string) {
        this.runId = runId;
        this.topic = topic;
        this.logs = {
            id: runId,
            topic,
            startedAt: new Date().toISOString(),
            status: 'running',
            steps: [],
            summary: {
                totalDuration: 0,
                totalTokens: 0,
                modelsUsed: [],
                modelsSucceeded: [],
                modelsFailed: [],
                errorsCount: 0,
                stepsCompleted: 0,
                stepsFailed: 0,
                stepsRunning: 0
            }
        };
    }

    // ============ STEP LIFECYCLE ============

    /**
     * Start a new step. Returns unique stepId for concurrent tracking.
     * Use this ID for all subsequent calls (modelAttempt, endStep, failStep).
     */
    startStep(config: {
        name: string;
        order: number;
        parentId?: string;
        stepKey?: string;  // e.g., "step5_summarize" 
    }, input?: any): string {
        const shortUuid = randomUUID().split('-')[0];
        const stepId = `step_${config.order}_${shortUuid}`;

        const step: StepLog = {
            id: stepId,
            parentId: config.parentId,
            name: config.name,
            order: config.order,
            status: 'running',
            startedAt: new Date().toISOString(),
            modelAttempts: [],
            input: this.sanitizeData(input),
            output: { preview: '', type: 'pending', size: 0, isTruncated: false },
            meta: {}
        };

        // Add to step history
        this.logs.steps.push(step);

        // Track in active map for concurrent access
        this.activeSteps.set(stepId, step);
        this.modelAttemptCounters.set(stepId, 0);

        // Update display name (just for UX, not for tracking)
        this.logs.currentStepName = config.name;
        this.logs.summary.stepsRunning++;

        console.log(`[PipelineLogger] Started: ${config.name} (${stepId})`);
        return stepId;
    }

    /**
     * Log a model attempt (success or failure)
     * Called by LLM provider wrapper
     */
    logModelAttempt(stepId: string, data: {
        provider: 'groq' | 'openrouter';
        model: string;
        status: 'success' | 'failed';
        startedAt: string;
        tokensIn?: number;
        tokensOut?: number;
        response?: string;
        error?: { type: string; code: string; message: string; raw?: string };
    }): void {
        const step = this.activeSteps.get(stepId);
        if (!step) {
            console.warn(`[PipelineLogger] Cannot log model attempt - step ${stepId} not active`);
            return;
        }

        // Increment counter
        const order = (this.modelAttemptCounters.get(stepId) || 0) + 1;
        this.modelAttemptCounters.set(stepId, order);

        const duration = Date.now() - new Date(data.startedAt).getTime();

        const attempt: ModelAttempt = {
            order,
            provider: data.provider,
            model: data.model,
            status: data.status,
            startedAt: data.startedAt,
            duration,
            tokensIn: data.tokensIn,
            tokensOut: data.tokensOut,
            responsePreview: data.response?.slice(0, MAX_PREVIEW_LENGTH)
        };

        // Handle error with size limits
        if (data.error) {
            attempt.error = {
                type: data.error.type,
                code: data.error.code,
                message: data.error.message,
                raw: data.error.raw?.slice(0, MAX_RAW_ERROR_LENGTH)
            };
        }

        step.modelAttempts.push(attempt);

        // Update summary
        const modelKey = `${data.provider}/${data.model}`;
        if (!this.logs.summary.modelsUsed.includes(modelKey)) {
            this.logs.summary.modelsUsed.push(modelKey);
        }

        if (data.status === 'success') {
            this.logs.summary.totalTokens += (data.tokensIn || 0) + (data.tokensOut || 0);
            if (!this.logs.summary.modelsSucceeded.includes(modelKey)) {
                this.logs.summary.modelsSucceeded.push(modelKey);
            }
        } else {
            if (!this.logs.summary.modelsFailed.includes(modelKey)) {
                this.logs.summary.modelsFailed.push(modelKey);
            }
        }
    }

    /**
     * End step successfully
     */
    endStep(stepId: string, output?: any, meta?: Record<string, any>): void {
        const step = this.activeSteps.get(stepId);
        if (!step) {
            console.warn(`[PipelineLogger] Cannot end step - ${stepId} not active`);
            return;
        }

        const now = new Date();
        step.status = 'success';
        step.completedAt = now.toISOString();
        step.duration = step.startedAt
            ? now.getTime() - new Date(step.startedAt).getTime()
            : 0;
        step.output = this.sanitizeData(output);

        if (meta) {
            step.meta = { ...step.meta, ...meta };
        }

        // Update summary
        this.logs.summary.stepsCompleted++;
        this.logs.summary.stepsRunning = Math.max(0, this.logs.summary.stepsRunning - 1);

        // Cleanup
        this.activeSteps.delete(stepId);
        this.modelAttemptCounters.delete(stepId);

        console.log(`[PipelineLogger] Completed: ${step.name} (${step.duration}ms)`);
    }

    /**
     * Fail step with error
     */
    failStep(stepId: string, error: any): void {
        const step = this.activeSteps.get(stepId);
        if (!step) {
            console.warn(`[PipelineLogger] Cannot fail step - ${stepId} not active`);
            return;
        }

        const now = new Date();
        step.status = 'failed';
        step.completedAt = now.toISOString();
        step.duration = step.startedAt
            ? now.getTime() - new Date(step.startedAt).getTime()
            : 0;

        // Explicitly serialize error (fix for Error objects not stringifying)
        step.error = {
            message: error?.message || String(error),
            code: error?.code || error?.name || 'UNKNOWN',
            stack: error?.stack?.slice(0, 2000)  // Limit stack trace
        };

        // Update summary
        this.logs.summary.stepsFailed++;
        this.logs.summary.errorsCount++;
        this.logs.summary.stepsRunning = Math.max(0, this.logs.summary.stepsRunning - 1);

        // Cleanup
        this.activeSteps.delete(stepId);
        this.modelAttemptCounters.delete(stepId);

        console.log(`[PipelineLogger] Failed: ${step.name} - ${step.error.message}`);
    }

    /**
     * Skip a step
     */
    skipStep(stepId: string, reason?: string): void {
        const step = this.activeSteps.get(stepId);
        if (!step) return;

        step.status = 'skipped';
        step.meta.skipReason = reason;

        this.activeSteps.delete(stepId);
        this.modelAttemptCounters.delete(stepId);
    }

    // ============ RUN LIFECYCLE ============

    endRun(status: 'completed' | 'failed'): PipelineRun {
        this.logs.completedAt = new Date().toISOString();
        this.logs.status = status;
        this.updateDuration();
        return this.logs;
    }

    private updateDuration(): void {
        if (this.logs.startedAt) {
            const endTime = this.logs.completedAt
                ? new Date(this.logs.completedAt).getTime()
                : Date.now();
            this.logs.summary.totalDuration = endTime - new Date(this.logs.startedAt).getTime();
        }
    }

    // ============ DATA SANITIZATION ============

    /**
     * Prevent memory overflow by truncating large data
     * Also redacts API keys from previews
     */
    private sanitizeData(data: any): DataSnapshot {
        if (data === null || data === undefined) {
            return { preview: '', type: 'null', size: 0, isTruncated: false };
        }

        let str: string;
        try {
            str = JSON.stringify(data, null, 2) || '';
        } catch {
            str = String(data);
        }

        const size = str.length;
        const isTruncated = size > MAX_PREVIEW_LENGTH;
        let preview = isTruncated
            ? str.slice(0, MAX_PREVIEW_LENGTH) + '... [Truncated]'
            : str;

        // Redact any API keys from preview
        preview = redactSensitiveData(preview);

        const snapshot: DataSnapshot = {
            preview,
            type: Array.isArray(data) ? 'array' : typeof data,
            size,
            isTruncated
        };

        if (Array.isArray(data)) {
            snapshot.itemCount = data.length;
        }

        return snapshot;
    }

    // ============ GETTERS ============

    /**
     * Get lightweight snapshot (for frequent polling)
     * Excludes full input/output, only previews
     */
    getLiteSnapshot(): LitePipelineRun {
        this.updateDuration();
        return {
            id: this.logs.id,
            topic: this.logs.topic,
            status: this.logs.status,
            startedAt: this.logs.startedAt,
            completedAt: this.logs.completedAt,
            currentStepName: this.logs.currentStepName,
            summary: this.logs.summary,
            steps: this.logs.steps.map(step => ({
                id: step.id,
                parentId: step.parentId,
                name: step.name,
                order: step.order,
                status: step.status,
                duration: step.duration,
                modelAttemptCount: step.modelAttempts.length,  // Just count for lite
                hasError: !!step.error
            }))
        };
    }

    /**
     * Get full snapshot (for detailed view)
     */
    getFullSnapshot(): PipelineRun {
        this.updateDuration();
        return this.logs;
    }

    /**
     * Get specific step details (for on-demand expansion)
     */
    getStepDetails(stepId: string): StepLog | undefined {
        return this.logs.steps.find(s => s.id === stepId);
    }

    /**
     * Legacy method for compatibility
     */
    getRun(): PipelineRun {
        return this.getFullSnapshot();
    }

    /**
     * Add metadata to current step
     */
    addMeta(stepId: string, key: string, value: any): void {
        const step = this.activeSteps.get(stepId);
        if (step) {
            step.meta[key] = value;
        }
    }
}

// ============ SINGLETON MANAGEMENT ============

let currentPipelineLogger: PipelineLogger | null = null;

export function createPipelineLogger(runId: string, topic: string): PipelineLogger {
    currentPipelineLogger = new PipelineLogger(runId, topic);
    return currentPipelineLogger;
}

export function getCurrentPipelineLogger(): PipelineLogger | null {
    return currentPipelineLogger;
}

export function clearPipelineLogger(): void {
    currentPipelineLogger = null;
}
