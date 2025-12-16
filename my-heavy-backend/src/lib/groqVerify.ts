import { getGroqClient } from './groq';
import { TranscribedVideo } from './groqTranscribe';

export interface VerifiedVideo extends TranscribedVideo {
    verification: {
        is_relevant: boolean;
        has_info: boolean;
        is_true: boolean;
        is_fresh: boolean;
        reason: string;
    };
}

export async function verifyVideosGroq(
    topic: string,
    videos: TranscribedVideo[],
    articleContext: string // Consolidated summary of articles
): Promise<VerifiedVideo[]> {
    const groq = getGroqClient();

    // We process videos in batches to avoid huge prompts, 
    // but for now, let's try to fit 5 videos + context in 128k window (easy).

    const videoDescriptions = videos.map((v, i) => `
    [VIDEO_ID: ${v.id}]
    Title: ${v.title}
    Channel: ${v.channel}
    Published: ${v.publishedAt}
    Description: ${v.description}
    Transcript/Snippet: "${v.transcript.substring(0, 2000)}..." (truncated)
    `).join("\n\n");

    const prompt = `
    TOPIC: "${topic}"
    
    VERIFIED FACTS (from News Articles):
    """
    ${articleContext.substring(0, 20000)}
    """

    CANDIDATE VIDEOS:
    """
    ${videoDescriptions}
    """

    TASK: Verify each video based on the following Strict Criteria:
    1. RELEVANCE: Is this video intimately related to the TOPIC?
    2. INFORMATION: Does it contain actual substantial information (not just clickbait/music)?
    3. TRUTH: Is the information consistent with the Verified Facts? (Mark "false" if it contradicts known facts).
    4. FRESHNESS: Is the video reasonably recent or timeless? (Mark "false" if it's ancient/obsolete for this specific news topic).

    OUTPUT FORMAT (Strict JSON Object):
    {
        "verifications": [
            {
                "video_id": "string",
                "is_relevant": boolean,
                "has_info": boolean,
                "is_true": boolean,
                "is_fresh": boolean,
                "reason": "Short explanation"
            }
        ]
    }
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a JSON-only Verification Agent." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const text = completion.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(text);
        const verdictMap = new Map<string, any>();

        if (parsed.verifications && Array.isArray(parsed.verifications)) {
            parsed.verifications.forEach((v: any) => verdictMap.set(v.video_id, v));
        }

        // Filter and Attach Verification Data
        const verifiedVideos: VerifiedVideo[] = [];

        for (const video of videos) {
            const verdict = verdictMap.get(video.id);
            if (!verdict) {
                // Default to fail if not mentioned
                continue;
            }

            // FILTERING LOGIC:
            // Must be Relevant AND Have Info AND Be True AND Be Fresh
            if (verdict.is_relevant && verdict.has_info && verdict.is_true && verdict.is_fresh) {
                verifiedVideos.push({
                    ...video,
                    verification: {
                        is_relevant: verdict.is_relevant,
                        has_info: verdict.has_info,
                        is_true: verdict.is_true,
                        is_fresh: verdict.is_fresh,
                        reason: verdict.reason
                    }
                });
            }
        }

        return verifiedVideos;

    } catch (e) {
        console.error("Video Verification Failed:", e);
        // Fallback: Return all if verification fails? Or none? 
        // Safer to return none or flag error, but let's return original list but marked as unverified to be safe?
        // Actually, user wants filtering. Returning empty is safer than returning garbage.
        return [];
    }
}
