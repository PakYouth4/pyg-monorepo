/**
 * retryStrategies.ts
 * ENHANCED: Step-specific retry strategies with alternative functions and AI selection
 */

import { StepEvaluation } from './orchestrator';

// ============ TYPES ============

export interface RetryContext {
    stepName: string;
    topic: string;
    originalInput?: Record<string, unknown>;
    evaluation: StepEvaluation;
    retryCount: number;
    maxRetries: number;
    previousStepResults?: Record<string, unknown>; // For step re-execution
}

export interface RetryModification {
    shouldRetry: boolean;
    modifiedInput?: Record<string, unknown>;
    reason: string;
    strategy: string;
    alternativeFunction?: string; // NEW: Which alternative function to use
    rerunStep?: string; // NEW: Which earlier step to re-run
}

// ============ ALTERNATIVE FUNCTION REGISTRY ============

/**
 * Registry of alternative functions per step
 * Each step can have multiple alternative implementations
 */
export interface AlternativeFunction {
    name: string;
    description: string;
    priority: number; // Lower = higher priority
}

export const ALTERNATIVE_FUNCTIONS: Record<string, AlternativeFunction[]> = {
    videos: [
        { name: 'searchYouTube', description: 'Primary YouTube search', priority: 1 },
        { name: 'searchYouTubeAlternate', description: 'YouTube with broader queries', priority: 2 },
        { name: 'searchVideoEmbeds', description: 'Search for embedded videos in articles', priority: 3 }
    ],
    news: [
        { name: 'searchTavily', description: 'Tavily news search', priority: 1 },
        { name: 'searchSerper', description: 'Serper Google search', priority: 2 },
        { name: 'searchNewsAPI', description: 'News API fallback', priority: 3 }
    ],
    scrape: [
        { name: 'scrapeFirecrawl', description: 'Firecrawl scraper', priority: 1 },
        { name: 'scrapeJina', description: 'Jina AI reader', priority: 2 },
        { name: 'scrapeCheerio', description: 'Basic HTML parsing', priority: 3 }
    ],
    transcribe: [
        { name: 'getYouTubeTranscript', description: 'YouTube captions API', priority: 1 },
        { name: 'transcribeWithWhisper', description: 'Whisper audio transcription', priority: 2 },
        { name: 'extractFromDescription', description: 'Use video description as fallback', priority: 3 }
    ],
    report: [
        { name: 'generateWithGroq', description: 'Groq LLM', priority: 1 },
        { name: 'generateWithOpenRouter', description: 'OpenRouter fallback', priority: 2 },
        { name: 'generateWithGemini', description: 'Gemini Flash', priority: 3 }
    ]
};

export function getNextAlternativeFunction(stepName: string, currentRetry: number): AlternativeFunction | null {
    const alternatives = ALTERNATIVE_FUNCTIONS[stepName];
    if (!alternatives || currentRetry >= alternatives.length) {
        return null;
    }
    return alternatives[currentRetry];
}

// ============ STEP DEPENDENCY GRAPH ============

/**
 * Defines which steps depend on which previous steps
 * Used for intelligent step re-execution
 */
export const STEP_DEPENDENCIES: Record<string, string[]> = {
    deepResearch: ['news'],
    videos: ['news', 'deepResearch'],
    transcribe: ['videos'],
    report: ['news', 'deepResearch', 'videos', 'transcribe']
};

export interface RerunRecommendation {
    shouldRerun: boolean;
    stepToRerun: string;
    reason: string;
}

export function getRerunRecommendation(
    failedStep: string,
    evaluation: StepEvaluation,
    previousStepResults?: Record<string, unknown>
): RerunRecommendation {
    // Check if the failure might be due to poor input from a previous step
    const dependencies = STEP_DEPENDENCIES[failedStep] || [];

    for (const dep of dependencies) {
        const depResult = previousStepResults?.[dep];

        // Check if dependency result was poor
        if (depResult && typeof depResult === 'object') {
            const depQuality = (depResult as Record<string, unknown>).quality;

            // If a dependency was partial/empty, recommend re-running it
            if (depQuality === 'partial' || depQuality === 'empty') {
                return {
                    shouldRerun: true,
                    stepToRerun: dep,
                    reason: `${failedStep} failed likely due to poor input from ${dep} (quality: ${depQuality}). Recommend re-running ${dep} with different strategy.`
                };
            }
        }
    }

    return {
        shouldRerun: false,
        stepToRerun: '',
        reason: 'No upstream issues detected'
    };
}

// ============ STRATEGY IMPLEMENTATIONS ============

/**
 * Broader Query Strategy
 * For search-based steps, broaden the search query
 */
export function broaderQueryStrategy(context: RetryContext): RetryModification {
    const { topic, retryCount } = context;

    const strategies = [
        () => ({
            modifiedTopic: topic.split(' ').slice(0, 2).join(' '),
            reason: `Simplified topic from "${topic}" to "${topic.split(' ').slice(0, 2).join(' ')}"`
        }),
        () => ({
            modifiedTopic: topic.split(' ')[0],
            reason: `Reduced to single keyword: "${topic.split(' ')[0]}"`
        }),
        () => ({
            modifiedTopic: `${topic.split(' ')[0]} news`,
            reason: `Added 'news' suffix: "${topic.split(' ')[0]} news"`
        })
    ];

    const strategyIndex = Math.min(retryCount, strategies.length - 1);
    const modification = strategies[strategyIndex]();

    return {
        shouldRetry: true,
        modifiedInput: { topic: modification.modifiedTopic },
        reason: modification.reason,
        strategy: 'broader_query'
    };
}

/**
 * Alternative Function Strategy - NEW
 * Try a completely different function implementation
 */
export function alternativeFunctionStrategy(context: RetryContext): RetryModification {
    const { stepName, retryCount } = context;

    const nextAlt = getNextAlternativeFunction(stepName, retryCount);

    if (nextAlt) {
        return {
            shouldRetry: true,
            modifiedInput: { useAlternativeFunction: true },
            reason: `Switching to alternative: ${nextAlt.description}`,
            strategy: 'alternative_function',
            alternativeFunction: nextAlt.name
        };
    }

    return {
        shouldRetry: false,
        reason: `No more alternatives available for ${stepName}`,
        strategy: 'alternative_function'
    };
}

/**
 * Step Re-execution Strategy - NEW
 * Recommend re-running an earlier step
 */
export function rerunEarlierStepStrategy(context: RetryContext): RetryModification {
    const { stepName, evaluation, previousStepResults } = context;

    const recommendation = getRerunRecommendation(stepName, evaluation, previousStepResults);

    if (recommendation.shouldRerun) {
        return {
            shouldRetry: true,
            reason: recommendation.reason,
            strategy: 'rerun_earlier_step',
            rerunStep: recommendation.stepToRerun
        };
    }

    return {
        shouldRetry: false,
        reason: 'No earlier step needs re-running',
        strategy: 'rerun_earlier_step'
    };
}

/**
 * Different Source Strategy
 * Try alternative data sources (ENHANCED)
 */
export function differentSourceStrategy(context: RetryContext): RetryModification {
    const { stepName, retryCount } = context;

    const sourceFallbacks: Record<string, string[]> = {
        'news': ['tavily', 'serper', 'bing', 'duckduckgo'],
        'videos': ['youtube', 'youtube_v2', 'video_embeds'],
        'scrape': ['firecrawl', 'jina', 'cheerio', 'puppeteer']
    };

    const sources = sourceFallbacks[stepName] || ['primary', 'secondary', 'tertiary'];
    const sourceIndex = Math.min(retryCount, sources.length - 1);
    const newSource = sources[sourceIndex];

    // Also get the alternative function
    const altFunc = getNextAlternativeFunction(stepName, retryCount);

    return {
        shouldRetry: sourceIndex < sources.length - 1,
        modifiedInput: { source: newSource },
        reason: `Switching to source: ${newSource}${altFunc ? ` (using ${altFunc.name})` : ''}`,
        strategy: 'different_source',
        alternativeFunction: altFunc?.name
    };
}

/**
 * Skip Strategy
 */
export function skipStrategy(context: RetryContext): RetryModification {
    return {
        shouldRetry: false,
        reason: `Skipping step "${context.stepName}" after ${context.retryCount} retries: ${context.evaluation.issue}`,
        strategy: 'skip'
    };
}

/**
 * Fallback Data Strategy
 */
export function fallbackDataStrategy(context: RetryContext): RetryModification {
    return {
        shouldRetry: false,
        modifiedInput: { useFallback: true },
        reason: `Using fallback data for "${context.stepName}"`,
        strategy: 'fallback_data'
    };
}

// ============ DYNAMIC AI STRATEGY SELECTION ============

export type StrategyType =
    | 'broader_query'
    | 'different_source'
    | 'alternative_function'
    | 'rerun_earlier_step'
    | 'skip'
    | 'fallback_data'
    | 'none'
    | 'ai_select'; // NEW: Let AI decide

/**
 * AI Strategy Selection prompt template
 * Used when strategy is 'ai_select'
 */
export function getAIStrategyPrompt(context: RetryContext): string {
    const alternatives = ALTERNATIVE_FUNCTIONS[context.stepName] || [];
    const dependencies = STEP_DEPENDENCIES[context.stepName] || [];

    return `
STEP: ${context.stepName}
TOPIC: ${context.topic}
ISSUE: ${context.evaluation.issue || 'Unknown issue'}
METRICS: ${JSON.stringify(context.evaluation.metrics || {})}
RETRY COUNT: ${context.retryCount}/${context.maxRetries}

AVAILABLE STRATEGIES:
1. broader_query - Simplify the search terms
2. alternative_function - Try: ${alternatives.map(a => a.name).join(', ') || 'None available'}
3. different_source - Switch to a different API/source
4. rerun_earlier_step - Re-run a previous step: ${dependencies.join(', ') || 'None'}
5. skip - Skip this step entirely
6. fallback_data - Use default/empty data

Analyze the failure and select the BEST strategy. Respond with JSON:
{
    "strategy": "broader_query" | "alternative_function" | "different_source" | "rerun_earlier_step" | "skip",
    "reason": "Brief explanation",
    "details": "Any specific modifications (e.g., which function to use, which step to rerun)"
}
`;
}

export function getRetryStrategy(
    strategyType: StrategyType,
    context: RetryContext
): RetryModification {
    switch (strategyType) {
        case 'broader_query':
            return broaderQueryStrategy(context);
        case 'alternative_function':
            return alternativeFunctionStrategy(context);
        case 'different_source':
            return differentSourceStrategy(context);
        case 'rerun_earlier_step':
            return rerunEarlierStepStrategy(context);
        case 'fallback_data':
            return fallbackDataStrategy(context);
        case 'skip':
        case 'none':
        default:
            return skipStrategy(context);
    }
}

// ============ STEP-SPECIFIC RETRY CONFIG (ENHANCED) ============

export interface StepRetryConfig {
    strategy: StrategyType;
    maxRetries: number;
    canSkip: boolean;
    fallbackBehavior?: 'empty_array' | 'empty_string' | 'null' | 'continue';
    useAISelection?: boolean; // NEW: Let AI pick strategy
    alternativesEnabled?: boolean; // NEW: Enable alternative functions
}

export const STEP_RETRY_CONFIGS: Record<string, StepRetryConfig> = {
    news: {
        strategy: 'ai_select', // AI decides
        maxRetries: 3,
        canSkip: false,
        useAISelection: true,
        alternativesEnabled: true
    },

    deepResearch: {
        strategy: 'different_source',
        maxRetries: 2,
        canSkip: true,
        fallbackBehavior: 'empty_string',
        alternativesEnabled: true
    },

    videos: {
        strategy: 'ai_select', // AI decides (most complex step)
        maxRetries: 3,
        canSkip: true,
        fallbackBehavior: 'empty_array',
        useAISelection: true,
        alternativesEnabled: true
    },

    transcribe: {
        strategy: 'alternative_function',
        maxRetries: 2,
        canSkip: true,
        fallbackBehavior: 'continue',
        alternativesEnabled: true
    },

    report: {
        strategy: 'ai_select',
        maxRetries: 3,
        canSkip: false,
        useAISelection: true,
        alternativesEnabled: true
    }
};

export function getStepRetryConfig(stepName: string): StepRetryConfig {
    return STEP_RETRY_CONFIGS[stepName] || {
        strategy: 'skip',
        maxRetries: 1,
        canSkip: true,
        useAISelection: false,
        alternativesEnabled: false
    };
}
