/**
 * pipelineLogger.ts
 * Comprehensive pipeline logging for debug dashboard
 * 
 * Features:
 * - Tracks all steps with status, duration, inputs, outputs
 * - Captures every model attempt with full error details
 * - Config-driven step registry for easy updates
 * - Progressive disclosure: summary + expandable details
 */

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
    response?: {
        preview: string;
        full: string;
    };
    // Failure data
    error?: {
        type: string;        // "rate_limit" | "model_decommissioned" | "json_parse" | "timeout"
        code: string;        // HTTP status or error code
        message: string;     // Human readable
        raw?: string;        // Full error JSON
    };
}

export interface StepInput {
    preview: string;         // First 200 chars
    full: any;               // Full data
    type: string;            // "string" | "array" | "object"
    size: number;            // Character count or array length
}

export interface StepOutput {
    preview: string;
    full: any;
    type: string;
    size: number;
}

export interface StepLog {
    id: string;              // "step1_keywords"
    name: string;            // "Keywords Generation"
    order: number;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    modelAttempts: ModelAttempt[];
    input: StepInput | null;
    output: StepOutput | null;
    error?: {
        message: string;
        code?: string;
        stack?: string;
    };
    meta: Record<string, any>;  // Step-specific data
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
}

export interface PipelineRun {
    id: string;
    topic: string;
    startedAt: string;
    completedAt?: string;
    status: 'running' | 'completed' | 'failed';
    currentStep?: string;
    steps: StepLog[];
    summary: PipelineSummary;
}

// ============ STEP REGISTRY (Config-Driven) ============

export interface StepDefinition {
    name: string;
    order: number;
    type: 'ai' | 'api' | 'transform';
    description: string;
}

export const STEP_REGISTRY: Record<string, StepDefinition> = {
    step1_keywords: {
        name: "Keywords Generation",
        order: 1,
        type: "ai",
        description: "Generate 10 search keywords from topic using LLM"
    },
    step2_search: {
        name: "Tavily Search",
        order: 2,
        type: "api",
        description: "Search for articles using keywords via Tavily API"
    },
    step3_scrape: {
        name: "Article Scraping",
        order: 3,
        type: "api",
        description: "Scrape content from article URLs via Firecrawl"
    },
    step4_structure: {
        name: "Content Structuring",
        order: 4,
        type: "ai",
        description: "Extract structured data from raw article text"
    },
    step5_summarize: {
        name: "Article Summarization",
        order: 5,
        type: "ai",
        description: "Create concise summaries of each article"
    },
    step6_queries: {
        name: "Video Query Generation",
        order: 6,
        type: "ai",
        description: "Generate YouTube search queries from summaries"
    },
    step7_videos: {
        name: "YouTube Search",
        order: 7,
        type: "api",
        description: "Search for relevant videos on YouTube"
    },
    step8_transcribe: {
        name: "Video Transcription",
        order: 8,
        type: "api",
        description: "Extract captions/transcripts from videos"
    },
    step9_merge: {
        name: "Knowledge Base Merge",
        order: 9,
        type: "ai",
        description: "Merge articles and videos with AI enrichment"
    },
    step10_normalize: {
        name: "Source Normalization",
        order: 10,
        type: "transform",
        description: "Standardize sources to canonical format"
    },
    step11_analyze: {
        name: "Deep Analysis",
        order: 11,
        type: "ai",
        description: "5-stage deep analysis (facts, geopolitics, Islamic, risks, recommendations)"
    },
    step12_content: {
        name: "Content Ideas",
        order: 12,
        type: "ai",
        description: "Generate social media content ideas"
    },
    step13_report: {
        name: "Report Assembly",
        order: 13,
        type: "transform",
        description: "Assemble final formatted report"
    }
};

// ============ HELPER FUNCTIONS ============

function createPreview(data: any, maxLength: number = 200): string {
    if (data === null || data === undefined) return '';
    if (typeof data === 'string') return data.substring(0, maxLength);
    if (Array.isArray(data)) {
        const items = data.slice(0, 5).map(item =>
            typeof item === 'string' ? item : JSON.stringify(item).substring(0, 50)
        );
        return items.join(', ') + (data.length > 5 ? ` ... (${data.length} total)` : '');
    }
    return JSON.stringify(data).substring(0, maxLength);
}

function getDataType(data: any): string {
    if (data === null) return 'null';
    if (Array.isArray(data)) return 'array';
    return typeof data;
}

function getDataSize(data: any): number {
    if (data === null || data === undefined) return 0;
    if (typeof data === 'string') return data.length;
    if (Array.isArray(data)) return data.length;
    return JSON.stringify(data).length;
}

// ============ PIPELINE LOGGER CLASS ============

export class PipelineLogger {
    private run: PipelineRun;
    private currentStep: StepLog | null = null;
    private currentModelAttempt: Partial<ModelAttempt> | null = null;
    private modelAttemptCount: number = 0;

    constructor(runId: string, topic: string) {
        this.run = {
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
                stepsFailed: 0
            }
        };

        // Initialize all steps as pending
        Object.entries(STEP_REGISTRY).forEach(([id, def]) => {
            this.run.steps.push({
                id,
                name: def.name,
                order: def.order,
                status: 'pending',
                modelAttempts: [],
                input: null,
                output: null,
                meta: {}
            });
        });

        // Sort by order
        this.run.steps.sort((a, b) => a.order - b.order);
    }

    // ============ STEP LIFECYCLE ============

    startStep(stepId: string, input?: any): void {
        const step = this.run.steps.find(s => s.id === stepId);
        if (!step) {
            console.warn(`[PipelineLogger] Unknown step: ${stepId}`);
            return;
        }

        step.status = 'running';
        step.startedAt = new Date().toISOString();
        this.run.currentStep = stepId;
        this.currentStep = step;
        this.modelAttemptCount = 0;

        if (input !== undefined) {
            step.input = {
                preview: createPreview(input),
                full: input,
                type: getDataType(input),
                size: getDataSize(input)
            };
        }

        console.log(`[PipelineLogger] Started: ${step.name}`);
    }

    endStep(output?: any, meta?: Record<string, any>): void {
        if (!this.currentStep) return;

        const now = new Date();
        this.currentStep.completedAt = now.toISOString();
        this.currentStep.status = 'success';
        this.currentStep.duration = this.currentStep.startedAt
            ? now.getTime() - new Date(this.currentStep.startedAt).getTime()
            : 0;

        if (output !== undefined) {
            this.currentStep.output = {
                preview: createPreview(output),
                full: output,
                type: getDataType(output),
                size: getDataSize(output)
            };
        }

        if (meta) {
            this.currentStep.meta = { ...this.currentStep.meta, ...meta };
        }

        this.run.summary.stepsCompleted++;
        this.updateSummary();

        console.log(`[PipelineLogger] Completed: ${this.currentStep.name} (${this.currentStep.duration}ms)`);
        this.currentStep = null;
        this.run.currentStep = undefined;
    }

    failStep(error: Error | string): void {
        if (!this.currentStep) return;

        const now = new Date();
        this.currentStep.completedAt = now.toISOString();
        this.currentStep.status = 'failed';
        this.currentStep.duration = this.currentStep.startedAt
            ? now.getTime() - new Date(this.currentStep.startedAt).getTime()
            : 0;

        this.currentStep.error = {
            message: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined
        };

        this.run.summary.stepsFailed++;
        this.run.summary.errorsCount++;
        this.updateSummary();

        console.log(`[PipelineLogger] Failed: ${this.currentStep.name} - ${this.currentStep.error.message}`);
        this.currentStep = null;
        this.run.currentStep = undefined;
    }

    skipStep(stepId: string, reason?: string): void {
        const step = this.run.steps.find(s => s.id === stepId);
        if (!step) return;

        step.status = 'skipped';
        step.meta.skipReason = reason;
    }

    // ============ MODEL ATTEMPT TRACKING ============

    startModelAttempt(provider: 'groq' | 'openrouter', model: string): void {
        this.modelAttemptCount++;
        this.currentModelAttempt = {
            order: this.modelAttemptCount,
            provider,
            model,
            startedAt: new Date().toISOString()
        };

        // Track unique models used
        const modelKey = `${provider}/${model}`;
        if (!this.run.summary.modelsUsed.includes(modelKey)) {
            this.run.summary.modelsUsed.push(modelKey);
        }
    }

    endModelAttempt(success: boolean, data: {
        tokensIn?: number;
        tokensOut?: number;
        response?: string;
        error?: { type: string; code: string; message: string; raw?: string };
    }): void {
        if (!this.currentModelAttempt || !this.currentStep) return;

        const now = new Date();
        const attempt: ModelAttempt = {
            order: this.currentModelAttempt.order!,
            provider: this.currentModelAttempt.provider!,
            model: this.currentModelAttempt.model!,
            status: success ? 'success' : 'failed',
            startedAt: this.currentModelAttempt.startedAt!,
            duration: now.getTime() - new Date(this.currentModelAttempt.startedAt!).getTime()
        };

        if (success) {
            attempt.tokensIn = data.tokensIn;
            attempt.tokensOut = data.tokensOut;
            if (data.response) {
                attempt.response = {
                    preview: createPreview(data.response),
                    full: data.response
                };
            }
            this.run.summary.totalTokens += (data.tokensIn || 0) + (data.tokensOut || 0);

            const modelKey = `${attempt.provider}/${attempt.model}`;
            if (!this.run.summary.modelsSucceeded.includes(modelKey)) {
                this.run.summary.modelsSucceeded.push(modelKey);
            }
        } else {
            attempt.error = data.error;
            this.run.summary.errorsCount++;

            const modelKey = `${attempt.provider}/${attempt.model}`;
            if (!this.run.summary.modelsFailed.includes(modelKey)) {
                this.run.summary.modelsFailed.push(modelKey);
            }
        }

        this.currentStep.modelAttempts.push(attempt);
        this.currentModelAttempt = null;
    }

    // ============ RUN LIFECYCLE ============

    endRun(status: 'completed' | 'failed'): PipelineRun {
        this.run.completedAt = new Date().toISOString();
        this.run.status = status;
        this.updateSummary();
        return this.run;
    }

    private updateSummary(): void {
        if (this.run.startedAt && this.run.completedAt) {
            this.run.summary.totalDuration =
                new Date(this.run.completedAt).getTime() -
                new Date(this.run.startedAt).getTime();
        } else if (this.run.startedAt) {
            this.run.summary.totalDuration =
                Date.now() - new Date(this.run.startedAt).getTime();
        }
    }

    // ============ GETTERS ============

    getRun(): PipelineRun {
        this.updateSummary();
        return this.run;
    }

    getCurrentStep(): StepLog | null {
        return this.currentStep;
    }

    getStep(stepId: string): StepLog | undefined {
        return this.run.steps.find(s => s.id === stepId);
    }

    toJSON(): string {
        return JSON.stringify(this.getRun(), null, 2);
    }

    // ============ CONVENIENCE METHODS ============

    addMeta(key: string, value: any): void {
        if (this.currentStep) {
            this.currentStep.meta[key] = value;
        }
    }

    log(message: string): void {
        console.log(`[Pipeline:${this.run.id}] ${message}`);
    }
}

// ============ SINGLETON FOR CURRENT RUN ============

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
