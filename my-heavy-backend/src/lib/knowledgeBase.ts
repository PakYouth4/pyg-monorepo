/**
 * Knowledge Base Merger
 * 
 * Merges articles and videos (and future sources like X, Reddit) into a unified format.
 * Extensible design: Add new source types by extending SourceType and adding normalizers.
 */

import { getGroqClient } from './groq';

// ============ TYPES ============

export type SourceType = "article" | "video" | "tweet" | "reddit_post"; // Extensible

export interface UnifiedSource {
    id: string;
    type: SourceType;
    title: string;
    url: string;
    publisher: string;
    date: string;
    summary: string;
    key_facts: string[];
    metadata: Record<string, unknown>; // Flexible field for type-specific data
}

// Input types (from previous steps)
export interface ArticleInput {
    id?: number;
    url: string;
    publisher: string;
    headline_summary: string;
    summary_bullets: string[];
}

export interface VideoInput {
    video_id: string;
    title: string;
    url: string;
    channel: string;
    published_at: string;
    description: string;
    views: string;
    relevance_score?: number;
    reason?: string;
}

// Future: Add TweetInput, RedditInput, etc.

// ============ NORMALIZERS ============

function normalizeArticle(article: ArticleInput, index: number): UnifiedSource {
    return {
        id: `article_${article.id || index}`,
        type: "article",
        title: article.headline_summary,
        url: article.url,
        publisher: article.publisher,
        date: "", // Articles don't always have dates in our current format
        summary: article.headline_summary,
        key_facts: article.summary_bullets || [],
        metadata: {}
    };
}

function normalizeVideo(video: VideoInput): UnifiedSource {
    return {
        id: `video_${video.video_id}`,
        type: "video",
        title: video.title,
        url: video.url,
        publisher: video.channel,
        date: video.published_at,
        summary: video.description?.substring(0, 300) || "",
        key_facts: [], // Videos don't have explicit facts in our current format
        metadata: {
            views: video.views,
            relevance_score: video.relevance_score,
            classification_reason: video.reason
        }
    };
}

// Future: Add normalizeTweet, normalizeRedditPost, etc.

// ============ MAIN MERGER ============

export interface MergeInput {
    articles?: ArticleInput[];
    videos?: VideoInput[];
    // Future: tweets?: TweetInput[], reddit_posts?: RedditInput[]
}

export interface MergeOutput {
    sources: UnifiedSource[];
    stats: {
        total: number;
        by_type: Record<SourceType, number>;
    };
}

export function mergeKnowledgeBase(input: MergeInput): MergeOutput {
    const sources: UnifiedSource[] = [];
    const stats: Record<SourceType, number> = {
        article: 0,
        video: 0,
        tweet: 0,
        reddit_post: 0
    };

    // Merge Articles
    if (input.articles && Array.isArray(input.articles)) {
        input.articles.forEach((article, i) => {
            sources.push(normalizeArticle(article, i));
            stats.article++;
        });
    }

    // Merge Videos
    if (input.videos && Array.isArray(input.videos)) {
        input.videos.forEach((video) => {
            sources.push(normalizeVideo(video));
            stats.video++;
        });
    }

    // Future: Merge Tweets, Reddit posts, etc.

    return {
        sources,
        stats: {
            total: sources.length,
            by_type: stats
        }
    };
}

// ============ OPTIONAL: GROQ ENRICHMENT ============
// Use this to generate key_facts for videos or clean up summaries

export async function enrichSourcesWithGroq(
    topic: string,
    sources: UnifiedSource[]
): Promise<UnifiedSource[]> {
    const groq = getGroqClient();

    // Only enrich sources that lack key_facts
    const sourcesNeedingEnrichment = sources.filter(s => s.key_facts.length === 0);

    if (sourcesNeedingEnrichment.length === 0) return sources;

    const prompt = `
TOPIC: "${topic}"

SOURCES TO ENRICH:
${sourcesNeedingEnrichment.map((s, i) => `
[${i}] Type: ${s.type}
Title: ${s.title}
Summary: ${s.summary}
`).join("\n")}

TASK: For each source, generate 2-3 key facts/takeaways based on the title and summary.

OUTPUT (Strict JSON):
{
    "enriched": [
        { "index": 0, "key_facts": ["fact 1", "fact 2"] }
    ]
}
`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a JSON-only enrichment agent." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            response_format: { type: "json_object" }
        });

        const text = completion.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(text);

        if (parsed.enriched && Array.isArray(parsed.enriched)) {
            parsed.enriched.forEach((e: { index: number; key_facts: string[] }) => {
                const source = sourcesNeedingEnrichment[e.index];
                if (source) {
                    source.key_facts = e.key_facts;
                }
            });
        }
    } catch (e) {
        console.error("Groq enrichment failed:", e);
    }

    return sources;
}
