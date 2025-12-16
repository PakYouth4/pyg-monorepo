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
    articleContext: string
): Promise<VerifiedVideo[]> {
    const groq = getGroqClient();

    const videoDescriptions = videos.map((v) => `<video id="${v.id}">
Title: ${v.title}
Channel: ${v.channel}
Published: ${v.publishedAt}
Transcript: ${v.transcript.substring(0, 1500)}
</video>`).join("\n");

    const systemPrompt = `You are a fact-checking video analyst. Verify videos against known facts. Be strict - only approve videos with genuine, accurate information. Output ONLY valid JSON.`;

    const userPrompt = `<topic>${topic}</topic>

<verified_facts>
${articleContext.substring(0, 15000)}
</verified_facts>

<videos>
${videoDescriptions}
</videos>

<task>
Verify each video against these criteria:
1. RELEVANT - Directly about the topic (not tangential)
2. INFORMATIVE - Contains substantial information (not clickbait/music)
3. ACCURATE - Consistent with verified facts (not misinformation)
4. FRESH - Recent or timeless content (not outdated)
</task>

<schema>
{
  "verifications": [
    {
      "video_id": "string",
      "is_relevant": boolean,
      "has_info": boolean,
      "is_true": boolean,
      "is_fresh": boolean,
      "reason": "1-2 sentence explanation"
    }
  ]
}
</schema>`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
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
