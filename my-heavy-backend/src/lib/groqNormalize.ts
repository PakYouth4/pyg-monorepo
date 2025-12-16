/**
 * groqNormalize.ts
 * Normalizes articles and videos into a canonical Source format
 * Uses Groq LLM to extract key facts and unify the structure
 */

import { callGroqWithFallback, MODEL_CHAINS } from './groq';

// ============ CANONICAL SOURCE INTERFACE ============
export interface CanonicalSource {
    id: string;
    type: 'article' | 'video';
    title: string;
    url: string;
    source: string;          // Publisher/Channel name
    summary: string;         // 2-3 sentence summary
    date: string;            // ISO date string
    credibility: 'high' | 'medium' | 'low' | 'unknown';
    keyFacts: string[];      // 3-5 key facts extracted
    relevanceScore: number;  // 0-1 score
    metadata: {
        originalData?: unknown;
        views?: number;
        readTime?: number;
    };
}

// ============ INPUT TYPES ============
export interface RawArticle {
    title: string;
    url: string;
    content?: string;
    raw_content?: string;
    summary?: string;
    score?: number;
    published_date?: string;
    source?: string;
}

export interface RawVideo {
    videoId: string;
    title: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    views?: number;
    classification?: {
        keep: boolean;
        score: number;
        reason: string;
    };
}

// ============ NORMALIZE ARTICLES ============
async function normalizeArticles(articles: RawArticle[], topic: string): Promise<CanonicalSource[]> {
    if (!articles || articles.length === 0) return [];

    console.log(`[Normalize] Processing ${articles.length} articles...`);

    const prompt = `
You are a research assistant. Convert these raw articles into normalized source objects.

TOPIC: "${topic}"

ARTICLES:
${JSON.stringify(articles.slice(0, 10), null, 2)}

For each article, output a JSON object with:
- id: Generate a unique ID (article_1, article_2, etc.)
- type: "article"
- title: The article title
- url: The article URL
- source: Extract publisher name from URL or content (e.g., "Al Jazeera", "BBC", "Reuters")
- summary: 2-3 sentence summary of the article content
- date: ISO date string (YYYY-MM-DD) if available, otherwise "unknown"
- credibility: "high" for major outlets (BBC, Reuters, AP, Al Jazeera), "medium" for regional news, "low" for blogs/unknown, "unknown" if can't determine
- keyFacts: Array of 3-5 key facts/claims from the article (short phrases)
- relevanceScore: 0-1 score based on how relevant the article is to the topic

OUTPUT MUST BE A VALID JSON ARRAY. NO MARKDOWN. NO EXPLANATION.

Example:
[
  {
    "id": "article_1",
    "type": "article",
    "title": "Crisis Deepens in Region",
    "url": "https://example.com/article",
    "source": "Reuters",
    "summary": "The situation continues to deteriorate. Officials report rising casualties.",
    "date": "2024-12-15",
    "credibility": "high",
    "keyFacts": ["100 casualties reported", "Peace talks scheduled", "UN urges ceasefire"],
    "relevanceScore": 0.9
  }
]`;

    try {
        const response = await callGroqWithFallback({
            messages: [{ role: "user", content: prompt }],
            modelChain: MODEL_CHAINS.SUMMARIZE,
            temperature: 0.2,
            jsonMode: true
        });

        const parsed = JSON.parse(response);
        const normalized: CanonicalSource[] = (Array.isArray(parsed) ? parsed : [parsed]).map((item: Record<string, unknown>, idx: number) => ({
            id: String(item.id || `article_${idx + 1}`),
            type: 'article' as const,
            title: String(item.title || ''),
            url: String(item.url || ''),
            source: String(item.source || 'Unknown'),
            summary: String(item.summary || ''),
            date: String(item.date || 'unknown'),
            credibility: (item.credibility as CanonicalSource['credibility']) || 'unknown',
            keyFacts: Array.isArray(item.keyFacts) ? item.keyFacts.map(String) : [],
            relevanceScore: Number(item.relevanceScore) || 0.5,
            metadata: { originalData: articles[idx] }
        }));

        console.log(`[Normalize] Normalized ${normalized.length} articles`);
        return normalized;

    } catch (error) {
        console.error('[Normalize] Error normalizing articles:', error);
        // Fallback: basic normalization without LLM
        return articles.map((article, idx) => ({
            id: `article_${idx + 1}`,
            type: 'article' as const,
            title: article.title,
            url: article.url,
            source: extractSourceFromUrl(article.url),
            summary: article.summary || article.content?.substring(0, 200) || '',
            date: article.published_date || 'unknown',
            credibility: 'unknown' as const,
            keyFacts: [],
            relevanceScore: article.score || 0.5,
            metadata: { originalData: article }
        }));
    }
}

// ============ NORMALIZE VIDEOS ============
async function normalizeVideos(videos: RawVideo[], topic: string): Promise<CanonicalSource[]> {
    if (!videos || videos.length === 0) return [];

    console.log(`[Normalize] Processing ${videos.length} videos...`);

    const prompt = `
You are a research assistant. Convert these YouTube videos into normalized source objects.

TOPIC: "${topic}"

VIDEOS:
${JSON.stringify(videos.slice(0, 10), null, 2)}

For each video, output a JSON object with:
- id: Generate a unique ID (video_1, video_2, etc.)
- type: "video"
- title: The video title
- url: Construct YouTube URL from videoId
- source: The channel name
- summary: 2-3 sentence summary based on title and description
- date: ISO date string (YYYY-MM-DD) from publishedAt
- credibility: "high" for verified news channels, "medium" for established creators, "low" for unknown channels
- keyFacts: Array of 3-5 key topics/claims the video likely covers (based on title/description)
- relevanceScore: Use the classification score if available, otherwise estimate 0-1

OUTPUT MUST BE A VALID JSON ARRAY. NO MARKDOWN. NO EXPLANATION.`;

    try {
        const response = await callGroqWithFallback({
            messages: [{ role: "user", content: prompt }],
            modelChain: MODEL_CHAINS.SUMMARIZE,
            temperature: 0.2,
            jsonMode: true
        });

        const parsed = JSON.parse(response);
        const normalized: CanonicalSource[] = (Array.isArray(parsed) ? parsed : [parsed]).map((item: Record<string, unknown>, idx: number) => ({
            id: String(item.id || `video_${idx + 1}`),
            type: 'video' as const,
            title: String(item.title || ''),
            url: String(item.url || `https://youtube.com/watch?v=${videos[idx]?.videoId}`),
            source: String(item.source || videos[idx]?.channelTitle || 'Unknown'),
            summary: String(item.summary || ''),
            date: String(item.date || 'unknown'),
            credibility: (item.credibility as CanonicalSource['credibility']) || 'unknown',
            keyFacts: Array.isArray(item.keyFacts) ? item.keyFacts.map(String) : [],
            relevanceScore: Number(item.relevanceScore) || videos[idx]?.classification?.score || 0.5,
            metadata: {
                originalData: videos[idx],
                views: videos[idx]?.views
            }
        }));

        console.log(`[Normalize] Normalized ${normalized.length} videos`);
        return normalized;

    } catch (error) {
        console.error('[Normalize] Error normalizing videos:', error);
        // Fallback: basic normalization without LLM
        return videos.map((video, idx) => ({
            id: `video_${idx + 1}`,
            type: 'video' as const,
            title: video.title,
            url: `https://youtube.com/watch?v=${video.videoId}`,
            source: video.channelTitle || 'Unknown',
            summary: video.description?.substring(0, 200) || '',
            date: video.publishedAt?.split('T')[0] || 'unknown',
            credibility: 'unknown' as const,
            keyFacts: [],
            relevanceScore: video.classification?.score || 0.5,
            metadata: { originalData: video, views: video.views }
        }));
    }
}

// ============ HELPER FUNCTIONS ============
function extractSourceFromUrl(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        // Remove www. and .com/.org/etc
        const parts = hostname.replace('www.', '').split('.');
        if (parts.length >= 2) {
            return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
        return hostname;
    } catch {
        return 'Unknown';
    }
}

// ============ MAIN NORMALIZE FUNCTION ============
export async function normalizeSources(
    articles: RawArticle[],
    videos: RawVideo[],
    topic: string
): Promise<{
    sources: CanonicalSource[];
    stats: {
        totalArticles: number;
        totalVideos: number;
        highCredibility: number;
        avgRelevance: number;
    };
}> {
    console.log(`[Normalize] Starting normalization for topic: "${topic}"`);
    console.log(`[Normalize] Input: ${articles.length} articles, ${videos.length} videos`);

    // Normalize in parallel
    const [normalizedArticles, normalizedVideos] = await Promise.all([
        normalizeArticles(articles, topic),
        normalizeVideos(videos, topic)
    ]);

    // Combine and sort by relevance
    const allSources = [...normalizedArticles, ...normalizedVideos]
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Calculate stats
    const highCredibility = allSources.filter(s => s.credibility === 'high').length;
    const avgRelevance = allSources.length > 0
        ? allSources.reduce((sum, s) => sum + s.relevanceScore, 0) / allSources.length
        : 0;

    console.log(`[Normalize] Output: ${allSources.length} canonical sources`);
    console.log(`[Normalize] Stats: ${highCredibility} high credibility, ${avgRelevance.toFixed(2)} avg relevance`);

    return {
        sources: allSources,
        stats: {
            totalArticles: normalizedArticles.length,
            totalVideos: normalizedVideos.length,
            highCredibility,
            avgRelevance: Math.round(avgRelevance * 100) / 100
        }
    };
}
