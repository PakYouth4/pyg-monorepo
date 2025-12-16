import { callGroqWithFallback, MODEL_CHAINS, getGroqClient } from './groq';
import { VideoResult } from './youtubeSearch';

export interface ClassifiedVideo {
    video_id: string;
    title: string;
    description: string;
    channel: string;
    views: string;
    published_at: string;
    url: string;
    thumbnail: string;
    keep: boolean;
    relevance_score: number; // 0-100
    reason: string;
}

export async function classifyVideosGroq(
    topic: string,
    videos: VideoResult[]
): Promise<ClassifiedVideo[]> {
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Build video summaries for the prompt
    const videoSummaries = videos.map((v, i) => `
[VIDEO_${i + 1}]
ID: ${v.id}
Title: ${v.title}
Channel: ${v.channel}
Views: ${v.views}
Published: ${v.publishedAt}
Description: ${v.description?.substring(0, 300) || "No description"}
`).join("\n");

    const prompt = `
TOPIC: "${topic}"
TODAY'S DATE: ${currentDate}

CANDIDATE VIDEOS:
${videoSummaries}

TASK: Classify each video for inclusion in a research report about the TOPIC.

CRITERIA:
1. RELEVANCE: Is the video directly related to the topic? (Score 0-100)
2. INFORMATION VALUE: Does title/description suggest useful content?
3. CREDIBILITY: Is the channel reputable (news org, official, documentary)?
4. RECENCY: Is the video recent enough? (Reject if more than 2 years old for news topics)
5. VIEW COUNT: Higher views suggest higher credibility/reach.

OUTPUT FORMAT (Strict JSON):
{
    "classifications": [
        {
            "video_id": "VIDEO_1",
            "keep": true,
            "score": 85,
            "reason": "1-2 sentence explanation"
        }
    ]
}

ONLY output valid JSON. No extra text.
`;

    try {
        const text = await callGroqWithFallback({
            messages: [
                { role: "system", content: "You are a JSON-only video classification agent." },
                { role: "user", content: prompt }
            ],
            modelChain: MODEL_CHAINS.CLASSIFY, // Heavy model for reasoning
            temperature: 0.1,
            jsonMode: true
        });

        console.log("Groq Classification Raw Response:", text.substring(0, 500));

        const parsed = JSON.parse(text);

        // Build result map - handle both "VIDEO_1" and actual video IDs
        const classificationMap = new Map<string, { keep: boolean; score: number; reason: string }>();

        if (parsed.classifications && Array.isArray(parsed.classifications)) {
            console.log(`Parsed ${parsed.classifications.length} classifications`);

            parsed.classifications.forEach((c: { video_id: string; keep: boolean; score: number; reason: string }, idx: number) => {
                // Try VIDEO_X format first
                const match = c.video_id.match(/VIDEO_(\d+)/i);
                if (match) {
                    const vidIdx = parseInt(match[1], 10) - 1;
                    if (videos[vidIdx]) {
                        classificationMap.set(videos[vidIdx].id, { keep: c.keep, score: c.score, reason: c.reason });
                    }
                } else {
                    // Assume it's a direct video ID
                    classificationMap.set(c.video_id, { keep: c.keep, score: c.score, reason: c.reason });
                }
            });
        }

        // Transform to ClassifiedVideo
        const results: ClassifiedVideo[] = videos.map((v) => {
            const classification = classificationMap.get(v.id);
            return {
                video_id: v.id,
                title: v.title,
                description: v.description,
                channel: v.channel,
                views: v.views,
                published_at: v.publishedAt,
                url: v.url,
                thumbnail: v.thumbnail,
                keep: classification?.keep ?? false,
                relevance_score: classification?.score ?? 0,
                reason: classification?.reason ?? "Not classified"
            };
        });

        return results;

    } catch (e) {
        console.error("Video Classification Failed:", e);
        return videos.map(v => ({
            video_id: v.id,
            title: v.title,
            description: v.description,
            channel: v.channel,
            views: v.views,
            published_at: v.publishedAt,
            url: v.url,
            thumbnail: v.thumbnail,
            keep: false,
            relevance_score: 0,
            reason: "Classification failed"
        }));
    }
}

export function filterKeptVideos(videos: ClassifiedVideo[], threshold: number = 50): ClassifiedVideo[] {
    return videos.filter(v => v.keep && v.relevance_score >= threshold);
}
