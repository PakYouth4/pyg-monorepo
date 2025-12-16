/**
 * embeddings.ts
 * Generates embeddings using HuggingFace Inference API
 * Stores and searches vectors in Supabase pgvector
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ============ CONFIGURATION ============
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkvhywujxxsmoqefwpki.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const HF_TOKEN = process.env.HF_TOKEN || '';

// HuggingFace model for embeddings (384 dimensions, fast, good quality)
const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const EMBEDDING_API_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${EMBEDDING_MODEL}`;

let supabase: SupabaseClient | null = null;

// ============ SUPABASE CLIENT ============
function getSupabaseClient(): SupabaseClient {
    if (!supabase) {
        if (!SUPABASE_KEY) {
            throw new Error('SUPABASE_KEY is required');
        }
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return supabase;
}

// ============ GENERATE EMBEDDING ============
export async function generateEmbedding(text: string): Promise<number[]> {
    if (!HF_TOKEN) {
        throw new Error('HF_TOKEN is required for embedding generation');
    }

    // Truncate text if too long (model has 512 token limit)
    const truncatedText = text.slice(0, 2000);

    try {
        const response = await fetch(EMBEDDING_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: truncatedText,
                options: { wait_for_model: true }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HuggingFace API error: ${error}`);
        }

        const result = await response.json();

        // Result is a 2D array [[...embedding...]], we need the first one
        if (Array.isArray(result) && Array.isArray(result[0])) {
            return result[0];
        }

        // Sometimes it returns 1D array directly
        if (Array.isArray(result) && typeof result[0] === 'number') {
            return result;
        }

        throw new Error('Unexpected embedding format from HuggingFace');

    } catch (error) {
        console.error('[Embeddings] Error generating embedding:', error);
        throw error;
    }
}

// ============ BATCH GENERATE EMBEDDINGS ============
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(`[Embeddings] Generating ${texts.length} embeddings...`);

    // Process in parallel with rate limiting
    const batchSize = 5;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(text => generateEmbedding(text))
        );
        results.push(...batchResults);

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < texts.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    console.log(`[Embeddings] Generated ${results.length} embeddings`);
    return results;
}

// ============ SOURCE EMBEDDING INTERFACE ============
export interface SourceEmbeddingInput {
    source_id: string;
    source_type: 'article' | 'video';
    topic: string;
    title: string;
    url: string;
    summary: string;
    metadata?: Record<string, unknown>;
}

// ============ STORE EMBEDDINGS ============
export async function storeSourceEmbeddings(sources: SourceEmbeddingInput[]): Promise<{
    stored: number;
    errors: number;
}> {
    const supabase = getSupabaseClient();
    console.log(`[Embeddings] Storing ${sources.length} source embeddings...`);

    let stored = 0;
    let errors = 0;

    // Generate embeddings for all sources
    const texts = sources.map(s => `${s.title}. ${s.summary}`);
    const embeddings = await generateBatchEmbeddings(texts);

    // Store each source with its embedding
    for (let i = 0; i < sources.length; i++) {
        try {
            const source = sources[i];
            const embedding = embeddings[i];

            const { error } = await supabase
                .from('source_embeddings')
                .insert({
                    source_id: source.source_id,
                    source_type: source.source_type,
                    topic: source.topic,
                    title: source.title,
                    url: source.url,
                    summary: source.summary,
                    embedding: embedding,
                    metadata: source.metadata || {}
                });

            if (error) {
                console.error(`[Embeddings] Error storing source ${source.source_id}:`, error);
                errors++;
            } else {
                stored++;
            }
        } catch (e) {
            console.error(`[Embeddings] Exception storing source:`, e);
            errors++;
        }
    }

    console.log(`[Embeddings] Stored ${stored}/${sources.length} embeddings (${errors} errors)`);
    return { stored, errors };
}

// ============ SEMANTIC SEARCH ============
export interface SearchResult {
    source_id: string;
    source_type: string;
    topic: string;
    title: string;
    url: string;
    summary: string;
    similarity: number;
    metadata: Record<string, unknown>;
}

export async function semanticSearch(
    query: string,
    options: {
        limit?: number;
        topic?: string;
        minSimilarity?: number;
    } = {}
): Promise<SearchResult[]> {
    const supabase = getSupabaseClient();
    const { limit = 10, topic, minSimilarity = 0.5 } = options;

    console.log(`[Embeddings] Semantic search for: "${query.slice(0, 50)}..."`);

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Build the RPC call for similarity search
    // We use a Postgres function for efficient vector search
    let rpcQuery = supabase.rpc('match_source_embeddings', {
        query_embedding: queryEmbedding,
        match_threshold: minSimilarity,
        match_count: limit
    });

    const { data, error } = await rpcQuery;

    if (error) {
        console.error('[Embeddings] Search error:', error);
        throw error;
    }

    console.log(`[Embeddings] Found ${data?.length || 0} similar sources`);

    // Filter by topic if specified
    let results = data || [];
    if (topic) {
        results = results.filter((r: SearchResult) =>
            r.topic.toLowerCase().includes(topic.toLowerCase())
        );
    }

    return results;
}

// ============ FIND SIMILAR PAST RESEARCH ============
export async function findSimilarResearch(
    currentTopic: string,
    currentSummary: string,
    limit: number = 5
): Promise<{
    hasSimilar: boolean;
    similar: SearchResult[];
    suggestion: string;
}> {
    const searchText = `${currentTopic}. ${currentSummary}`;

    const similar = await semanticSearch(searchText, {
        limit,
        minSimilarity: 0.7  // High threshold for "similar"
    });

    const hasSimilar = similar.length > 0;

    let suggestion = '';
    if (hasSimilar) {
        const topics = [...new Set(similar.map(s => s.topic))];
        suggestion = `Found ${similar.length} similar sources from past research on: ${topics.join(', ')}`;
    }

    return {
        hasSimilar,
        similar,
        suggestion
    };
}

// ============ GET RESEARCH HISTORY BY TOPIC ============
export async function getResearchHistory(topic: string): Promise<SearchResult[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from('source_embeddings')
        .select('*')
        .ilike('topic', `%${topic}%`)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('[Embeddings] History fetch error:', error);
        throw error;
    }

    return data || [];
}
