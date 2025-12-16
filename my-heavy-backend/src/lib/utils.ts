/**
 * utils.ts
 * Shared utilities for production-ready operations
 * - Retry with exponential backoff
 * - Health checks
 * - Error handling
 */

// ============ RETRY WITH BACKOFF ============

export interface RetryOptions {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryOn?: (error: Error) => boolean;
}

const defaultRetryOptions: RetryOptions = {
    maxRetries: 5,
    initialDelayMs: 1000,      // 1 second
    maxDelayMs: 30000,         // 30 seconds max
    backoffMultiplier: 2,
    retryOn: (error) => {
        // Retry on network errors and rate limits
        const message = error.message?.toLowerCase() || '';
        return (
            message.includes('network') ||
            message.includes('timeout') ||
            message.includes('rate_limit') ||
            message.includes('429') ||
            message.includes('503') ||
            message.includes('502') ||
            message.includes('econnrefused') ||
            message.includes('enotfound')
        );
    }
};

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...defaultRetryOptions, ...options };
    let lastError: Error | null = null;
    let delay = opts.initialDelayMs!;

    for (let attempt = 1; attempt <= opts.maxRetries!; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            // Check if we should retry this error
            if (!opts.retryOn!(lastError)) {
                console.error(`[Retry] Non-retryable error on attempt ${attempt}:`, lastError.message);
                throw lastError;
            }

            if (attempt < opts.maxRetries!) {
                console.warn(`[Retry] Attempt ${attempt}/${opts.maxRetries} failed: ${lastError.message}`);
                console.log(`[Retry] Waiting ${delay}ms before retry...`);

                await sleep(delay);
                delay = Math.min(delay * opts.backoffMultiplier!, opts.maxDelayMs!);
            }
        }
    }

    console.error(`[Retry] All ${opts.maxRetries} attempts failed`);
    throw lastError;
}

// ============ SLEEP UTILITY ============

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ PREFLIGHT HEALTH CHECK ============

export interface HealthCheckResult {
    service: string;
    status: 'ok' | 'degraded' | 'down';
    latencyMs: number;
    error?: string;
}

export interface PreflightResult {
    canProceed: boolean;
    checks: HealthCheckResult[];
    warnings: string[];
}

async function checkGroq(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
        // Simple presence check - actual test happens on first call
        if (!process.env.GROQ_API_KEY) {
            return { service: 'groq', status: 'down', latencyMs: 0, error: 'GROQ_API_KEY not set' };
        }
        return { service: 'groq', status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
        return { service: 'groq', status: 'down', latencyMs: Date.now() - start, error: String(error) };
    }
}

async function checkTavily(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
        if (!process.env.TAVILY_API_KEY) {
            return { service: 'tavily', status: 'degraded', latencyMs: 0, error: 'TAVILY_API_KEY not set' };
        }
        return { service: 'tavily', status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
        return { service: 'tavily', status: 'degraded', latencyMs: Date.now() - start, error: String(error) };
    }
}

async function checkFirecrawl(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
        if (!process.env.FIRECRAWL_API_KEY) {
            return { service: 'firecrawl', status: 'degraded', latencyMs: 0, error: 'FIRECRAWL_API_KEY not set' };
        }
        return { service: 'firecrawl', status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
        return { service: 'firecrawl', status: 'degraded', latencyMs: Date.now() - start, error: String(error) };
    }
}

async function checkYouTube(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
        if (!process.env.YOUTUBE_API_KEY) {
            return { service: 'youtube', status: 'degraded', latencyMs: 0, error: 'YOUTUBE_API_KEY not set' };
        }
        return { service: 'youtube', status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
        return { service: 'youtube', status: 'degraded', latencyMs: Date.now() - start, error: String(error) };
    }
}

export async function runPreflightChecks(): Promise<PreflightResult> {
    console.log('[Preflight] Running health checks...');

    const checks = await Promise.all([
        checkGroq(),
        checkTavily(),
        checkFirecrawl(),
        checkYouTube()
    ]);

    const warnings: string[] = [];
    let canProceed = true;

    checks.forEach(check => {
        if (check.status === 'down') {
            if (check.service === 'groq') {
                canProceed = false;  // Groq is critical
            }
            warnings.push(`${check.service.toUpperCase()} is DOWN: ${check.error}`);
        } else if (check.status === 'degraded') {
            warnings.push(`${check.service.toUpperCase()} is degraded: ${check.error}`);
        }
    });

    console.log(`[Preflight] Complete. Can proceed: ${canProceed}`);
    if (warnings.length > 0) {
        console.warn('[Preflight] Warnings:', warnings);
    }

    return { canProceed, checks, warnings };
}

// ============ SAFE JSON PARSE ============

export function safeJsonParse<T>(text: string, fallback: T): T {
    try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const toParse = jsonMatch ? jsonMatch[1].trim() : text.trim();
        return JSON.parse(toParse);
    } catch {
        console.warn('[SafeParse] Failed to parse JSON, using fallback');
        return fallback;
    }
}

// ============ TRUNCATE TEXT ============

export function truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}
