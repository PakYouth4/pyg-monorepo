/**
 * retryStrategies.ts
 * Step-specific retry strategies for the workflow orchestrator
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
}

export interface RetryModification {
    shouldRetry: boolean;
    modifiedInput?: Record<string, unknown>;
    reason: string;
    strategy: string;
}

// ============ STRATEGY IMPLEMENTATIONS ============

/**
 * Broader Query Strategy
 * For search-based steps, broaden the search query
 */
export function broaderQueryStrategy(context: RetryContext): RetryModification {
    const { stepName, topic, retryCount, evaluation } = context;

    // Different broadening strategies per retry
    const strategies = [
        // First retry: simplify topic
        () => ({
            modifiedTopic: topic.split(' ').slice(0, 2).join(' '),
            reason: `Simplified topic from "${topic}" to "${topic.split(' ').slice(0, 2).join(' ')}"`
        }),
        // Second retry: use first word only
        () => ({
            modifiedTopic: topic.split(' ')[0],
            reason: `Reduced to single keyword: "${topic.split(' ')[0]}"`
        }),
        // Third retry: add "news" suffix
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
 * Different Source Strategy
 * Try alternative data sources
 */
export function differentSourceStrategy(context: RetryContext): RetryModification {
    const { stepName, retryCount } = context;

    // Define fallback sources per step
    const sourceFallbacks: Record<string, string[]> = {
        'news': ['tavily', 'serper', 'bing'],
        'videos': ['youtube', 'dailymotion', 'vimeo'],
        'scrape': ['firecrawl', 'jina', 'cheerio']
    };

    const sources = sourceFallbacks[stepName] || ['primary', 'secondary'];
    const sourceIndex = Math.min(retryCount, sources.length - 1);
    const newSource = sources[sourceIndex];

    return {
        shouldRetry: true,
        modifiedInput: { source: newSource },
        reason: `Switching to alternative source: ${newSource}`,
        strategy: 'different_source'
    };
}

/**
 * Skip Strategy
 * Gracefully skip the step
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
 * Use cached or default data
 */
export function fallbackDataStrategy(context: RetryContext): RetryModification {
    return {
        shouldRetry: false,
        modifiedInput: { useFallback: true },
        reason: `Using fallback data for "${context.stepName}"`,
        strategy: 'fallback_data'
    };
}

// ============ STRATEGY SELECTOR ============

export type StrategyType = 'broader_query' | 'different_source' | 'skip' | 'fallback_data' | 'none';

export function getRetryStrategy(
    strategyType: StrategyType,
    context: RetryContext
): RetryModification {
    switch (strategyType) {
        case 'broader_query':
            return broaderQueryStrategy(context);
        case 'different_source':
            return differentSourceStrategy(context);
        case 'fallback_data':
            return fallbackDataStrategy(context);
        case 'skip':
        case 'none':
        default:
            return skipStrategy(context);
    }
}

// ============ STEP-SPECIFIC RETRY CONFIG ============

export interface StepRetryConfig {
    strategy: StrategyType;
    maxRetries: number;
    canSkip: boolean;
    fallbackBehavior?: 'empty_array' | 'empty_string' | 'null' | 'continue';
}

export const STEP_RETRY_CONFIGS: Record<string, StepRetryConfig> = {
    // Critical steps - cannot skip
    news: {
        strategy: 'broader_query',
        maxRetries: 3,
        canSkip: false
    },

    // Important but can continue without
    deepResearch: {
        strategy: 'skip',
        maxRetries: 1,
        canSkip: true,
        fallbackBehavior: 'empty_string'
    },

    // Video steps - broaden search if empty
    videos: {
        strategy: 'broader_query',
        maxRetries: 2,
        canSkip: true,
        fallbackBehavior: 'empty_array'
    },

    transcribe: {
        strategy: 'skip',
        maxRetries: 1,
        canSkip: true,
        fallbackBehavior: 'continue'
    },

    // Final report - cannot skip
    report: {
        strategy: 'different_source',
        maxRetries: 2,
        canSkip: false
    }
};

export function getStepRetryConfig(stepName: string): StepRetryConfig {
    return STEP_RETRY_CONFIGS[stepName] || {
        strategy: 'skip',
        maxRetries: 1,
        canSkip: true
    };
}
