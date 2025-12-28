/**
 * llmProvider.ts
 * Unified LLM provider with multi-provider fallback (OpenRouter + Groq)
 * 
 * Strategy:
 * - Task-specific model chains
 * - Automatic failover between providers
 * - Smart error handling with rate limit detection
 */

import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

// ============ PROVIDERS ============

type Provider = 'groq' | 'openrouter';

interface ModelConfig {
    provider: Provider;
    model: string;
}

// ============ TASK-SPECIFIC MODEL CHAINS ============
// Based on user's optimized assignments (Dec 2025)
// Each task has PRIMARY → FALLBACK1 → FALLBACK2

export const TASK_MODELS = {
    // Step 1 & Step 6: Fast/Simple keyword generation
    KEYWORDS: [
        { provider: 'groq', model: 'llama-3.1-8b-instant' },           // Primary: Fast, high rate limit
        { provider: 'openrouter', model: 'google/gemma-2-9b-it:free' }, // Fallback: Good JSON adherence
        { provider: 'openrouter', model: 'meta-llama/llama-3.2-3b-instruct:free' } // Fallback: Very lightweight
    ],

    // Step 6: Video queries (same as keywords)
    QUERIES: [
        { provider: 'groq', model: 'llama-3.1-8b-instant' },
        { provider: 'openrouter', model: 'google/gemma-2-9b-it:free' },
        { provider: 'openrouter', model: 'meta-llama/llama-3.2-3b-instruct:free' }
    ],

    // Step 4: Extract structure from messy HTML (needs 70B intelligence)
    STRUCTURE: [
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },        // Primary: Handles messy text
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' }, // 1M context fallback
        { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' }   // SOTA for JSON extraction
    ],

    // Step 5: Summarize (called 5x parallel, needs efficient model)
    SUMMARIZE: [
        { provider: 'groq', model: 'llama-3.1-8b-instant' },           // Primary: Handles burst requests
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' }, // 1M context
        { provider: 'openrouter', model: 'mistralai/mistral-nemo:free' }       // Good at summarization
    ],

    // Step 9: Merge/Enrich (classification)
    CLASSIFY: [
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },        // Needs reasoning for credibility
        { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' }, // Same model, different provider
        { provider: 'openrouter', model: 'nvidia/llama-3.1-nemotron-70b-instruct:free' } // Good at categorization
    ],

    // Step 11a: Extract Key Facts (HUGE CONTEXT - needs 1M tokens)
    EXTRACT_FACTS: [
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' }, // Primary: 1M context essential
        { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' },  // 32k-128k context
        { provider: 'groq', model: 'llama-3.3-70b-versatile' }                 // 128k context last resort
    ],

    // Step 11b & 11d: Geopolitics & Risk Analysis (needs reasoning/CoT)
    REASONING: [
        { provider: 'openrouter', model: 'deepseek/deepseek-r1:free' },        // Primary: Chain of Thought
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },                 // Fallback: Strong world knowledge
        { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' }   // Fallback: Good logic
    ],

    // Step 11c: Islamic Perspective (needs cultural nuance)
    ISLAMIC: [
        { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' },  // Primary: Less Western-centric
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },                 // Fallback: Needs careful prompting
        { provider: 'openrouter', model: 'google/gemma-2-27b-it:free' }        // Fallback: Safety-tuned
    ],

    // Step 11e: Recommendations (needs synthesis + actionable output)
    RECOMMENDATIONS: [
        { provider: 'openrouter', model: 'deepseek/deepseek-r1:free' },        // Primary: Good for planning
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },                 // Fallback: Reliable
        { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' }
    ],

    // Step 12: Creative content ideas
    CONTENT_IDEAS: [
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },                 // Primary: Natural "chatty" tone
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' }, // Fallback: Creative
        { provider: 'openrouter', model: 'nousresearch/hermes-3-llama-3.1-405b:free' } // Fallback: Engaging
    ],

    // Legacy/Default (keeping for backward compatibility)
    DEEP_ANALYSIS: [
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'openrouter', model: 'deepseek/deepseek-r1:free' }
    ],

    VERIFY: [
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' }
    ],

    NORMALIZE: [
        { provider: 'groq', model: 'llama-3.1-8b-instant' },
        { provider: 'openrouter', model: 'mistralai/mistral-nemo:free' }
    ],

    REPORT: [
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' }
    ]
} as const;

export type TaskType = keyof typeof TASK_MODELS;

// ============ CLIENTS ============

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
    if (!groqClient) {
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY is missing');
        }
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groqClient;
}

async function callOpenRouter(
    model: string,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    jsonMode: boolean
): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is missing');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://insight.pakyouth.org',
            'X-Title': 'Insight Research Tool'
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
        })
    });

    if (!response.ok) {
        const status = response.status;
        const text = await response.text();

        if (status === 429) throw new Error('RATE_LIMIT');
        if (status === 402) throw new Error('QUOTA_EXCEEDED');
        if (status >= 500) throw new Error('SERVER_ERROR');

        throw new Error(`OpenRouter error ${status}: ${text}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

async function callGroq(
    model: string,
    messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>,
    temperature: number,
    jsonMode: boolean
): Promise<string> {
    const client = getGroqClient();

    const completion = await client.chat.completions.create({
        model,
        messages,
        temperature,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
    });

    return completion.choices[0]?.message?.content || '';
}

// ============ MAIN UNIFIED CALL ============

interface LLMCallOptions {
    task: TaskType;
    messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>;
    temperature?: number;
    jsonMode?: boolean;
}

export async function callLLM(options: LLMCallOptions): Promise<string> {
    const { task, messages, temperature = 0.3, jsonMode = false } = options;
    const modelChain = TASK_MODELS[task];

    for (let i = 0; i < modelChain.length; i++) {
        const { provider, model } = modelChain[i];

        try {
            console.log(`[LLM] Task=${task} Provider=${provider} Model=${model}`);

            let result: string;

            if (provider === 'groq') {
                result = await callGroq(model, messages, temperature, jsonMode);
            } else {
                result = await callOpenRouter(model, messages, temperature, jsonMode);
            }

            if (!result || result.trim() === '') {
                console.warn(`[LLM] Empty response from ${model}, trying next...`);
                continue;
            }

            console.log(`[LLM] Success with ${model}`);
            return result;

        } catch (error: unknown) {
            const err = error as Error;
            const errorMsg = err?.message || String(error);

            console.warn(`[LLM] ${model} failed: ${errorMsg}`);

            // Rate limit: short wait then try next
            if (errorMsg === 'RATE_LIMIT') {
                console.log('[LLM] Rate limited, waiting 5s...');
                await new Promise(r => setTimeout(r, 5000));
            }

            // Quota exceeded: try next provider immediately
            if (errorMsg === 'QUOTA_EXCEEDED') {
                console.log('[LLM] Quota exceeded, switching provider...');
            }

            // Continue to next model in chain
            continue;
        }
    }

    throw new Error(`[LLM] All models failed for task: ${task}`);
}

// ============ LEGACY COMPATIBILITY ============
// Keep old MODEL_CHAINS for any code that still uses it

export const MODEL_CHAINS = {
    KEYWORDS: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'],
    SUMMARIZE: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'],
    CLASSIFY: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile'],
    DEFAULT: ['llama-3.3-70b-versatile']
};

// Legacy function - calls Groq only
export async function callGroqWithFallback(options: {
    messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>;
    modelChain: string[];
    temperature?: number;
    jsonMode?: boolean;
}): Promise<string> {
    const { messages, modelChain, temperature = 0.3, jsonMode = false } = options;

    for (const model of modelChain) {
        try {
            return await callGroq(model, messages, temperature, jsonMode);
        } catch (error) {
            console.warn(`[Groq] ${model} failed, trying next...`);
            continue;
        }
    }

    throw new Error('All Groq models failed');
}

export { getGroqClient };
