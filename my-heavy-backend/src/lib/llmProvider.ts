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
// Each task has PRIMARY → ALT1 → ALT2 fallback

export const TASK_MODELS = {
    // Fast/Simple tasks
    KEYWORDS: [
        { provider: 'groq', model: 'llama-3.1-8b-instant' },
        { provider: 'openrouter', model: 'qwen/qwen3-4b:free' },
        { provider: 'openrouter', model: 'google/gemma-3-4b-it:free' }
    ],

    QUERIES: [
        { provider: 'groq', model: 'llama-3.1-8b-instant' },
        { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free' },
        { provider: 'groq', model: 'llama-3.3-70b-versatile' }
    ],

    // Medium tasks
    STRUCTURE: [
        { provider: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free' },
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'openrouter', model: 'qwen/qwen3-235b-a22b:free' }
    ],

    SUMMARIZE: [
        { provider: 'openrouter', model: 'qwen/qwen3-235b-a22b:free' },
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
        { provider: 'groq', model: 'llama-3.3-70b-versatile' }
    ],

    NORMALIZE: [
        { provider: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free' },
        { provider: 'groq', model: 'qwen/qwen3-32b' },
        { provider: 'openrouter', model: 'qwen/qwen3-coder:free' }
    ],

    // Heavy reasoning tasks
    CLASSIFY: [
        { provider: 'openrouter', model: 'allenai/olmo-3-32b-think:free' },
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'openrouter', model: 'qwen/qwen3-235b-a22b:free' }
    ],

    VERIFY: [
        { provider: 'openrouter', model: 'allenai/olmo-3-32b-think:free' },
        { provider: 'openrouter', model: 'openai/gpt-oss-120b:free' },
        { provider: 'groq', model: 'llama-3.3-70b-versatile' }
    ],

    DEEP_ANALYSIS: [
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'openrouter', model: 'qwen/qwen3-235b-a22b:free' },
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
        { provider: 'openrouter', model: 'allenai/olmo-3-32b-think:free' }
    ],

    CONTENT_IDEAS: [
        { provider: 'groq', model: 'llama-3.1-8b-instant' },
        { provider: 'openrouter', model: 'qwen/qwen3-235b-a22b:free' },
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' }
    ],

    // Huge context tasks
    REPORT: [
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
        { provider: 'openrouter', model: 'amazon/nova-2-lite-v1:free' },
        { provider: 'openrouter', model: 'qwen/qwen3-coder:free' }
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
