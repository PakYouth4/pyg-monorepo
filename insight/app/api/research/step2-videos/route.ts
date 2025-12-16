import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { newsSummary } = await req.json();
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

        // We use JSON Schema to ensure the AI gives us a perfect list of words
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                }
            }
        });

        const debugLog = [];

        // --- PHASE 1: GENERATE BROAD SEO TERMS ---
        // We force the AI to give us ONE-WORD nouns.
        const keywordPrompt = `
            NEWS CONTEXT: "${newsSummary}"

            TASK: Generate 5 BROAD, SINGLE-WORD SEO tags to find video footage.
            
            RULES:
            1. ONE WORD ONLY per tag (e.g. "Gaza", not "Gaza crisis").
            2. USE NOUNS (Places, People, Organizations).
            3. NO ABSTRACT CONCEPTS (No "Humanitarian", "Crisis", "War").
            4. MUST be high-volume search terms.

            Example Output: ["Gaza", "Rafah", "IDF", "UNRWA", "Egypt"]
        `;

        const keywordResult = await model.generateContent(keywordPrompt);
        const keywords = JSON.parse(keywordResult.response.text()); // Guaranteed Array

        debugLog.push(`🔍 SEO Terms Generated: ${JSON.stringify(keywords)}`);

        // --- PHASE 2: THE WIDE NET (Search) ---
        // Search for every single keyword and collect ALL candidates.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let candidates: any[] = [];

        for (const word of keywords) {
            try {
                // Search for 3 videos per keyword (Reduced from 5 to save time)
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(word)}&maxResults=3&type=video&order=date&key=${process.env.YOUTUBE_API_KEY}`;

                const res = await fetch(searchUrl);
                const data = await res.json();

                if (data.error) {
                    console.error(`[YouTube API Error] for "${word}":`, data.error);
                    debugLog.push(`❌ Error for "${word}": ${data.error.message}`);
                    if (data.error.code === 403) {
                        throw new Error(`YouTube API Quota Exceeded or Forbidden. Message: ${data.error.message}`);
                    }
                    continue;
                }

                if (data.items) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const found = data.items.map((item: any) => ({
                        id: item.id.videoId,
                        title: item.snippet.title,
                        channel: item.snippet.channelTitle,
                        description: item.snippet.description,
                        foundByKeyword: word // Track which SEO term found this
                    }));
                    candidates = [...candidates, ...found];
                }
            } catch (e) {
                console.error("Search error", e);
                // Re-throw if it's a critical API error
                if (e instanceof Error && e.message.includes("Quota")) throw e;
            }
        }

        // Deduplicate candidates (remove videos found by multiple keywords)
        candidates = Array.from(new Map(candidates.map(c => [c.id, c])).values());
        debugLog.push(`📥 Total Candidates Found: ${candidates.length}`);

        if (candidates.length === 0) {
            return NextResponse.json({ videos: [], queries: keywords, debug: debugLog });
        }

        // --- PHASE 3: THE SMART FILTER (AI Selection) ---
        // We use a strict Schema to force the AI to say "Yes" or "No" for EVERY video.

        const filterModel = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            id: { type: SchemaType.STRING },
                            isRelevant: { type: SchemaType.BOOLEAN },
                            reason: { type: SchemaType.STRING }
                        },
                        required: ["id", "isRelevant"]
                    }
                }
            }
        });

        const filterPrompt = `
            ORIGINAL NEWS STORY:
            "${newsSummary}"

            CANDIDATE VIDEOS:
            ${JSON.stringify(candidates.map(c => ({
            id: c.id,
            title: c.title,
            desc: c.description.substring(0, 150)
        })))}
            
            TASK:
            Evaluate EACH video in the list. Is it relevant to the news story?
            - Return "true" ONLY if it provides visual evidence, reporting, or commentary on the specific event.
            - Return "false" for gaming, generic vlogs, unrelated topics, or old news.
            
            OUTPUT:
            A JSON Array of objects with "id", "isRelevant" (boolean), and "reason".
        `;

        const filterResult = await filterModel.generateContent(filterPrompt);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const evaluations: any[] = JSON.parse(filterResult.response.text());

        // Filter for the "Yes" videos
        const validIds = evaluations.filter(e => e.isRelevant).map(e => e.id);

        debugLog.push(`✅ AI Evaluated ${evaluations.length} videos. Approved: ${validIds.length}`);
        debugLog.push(`📝 Rejection Reasons: ${JSON.stringify(evaluations.filter(e => !e.isRelevant).slice(0, 3).map(e => e.reason))}`);

        // --- PHASE 4: RETURN CANDIDATES (For Daisy-Chaining) ---
        // We do NOT fetch transcripts here anymore. We return the list of "Approved" videos.
        // The frontend will loop through them and call Step 2.5 for each.

        const approvedVideos = candidates.filter(c => validIds.includes(c.id)).slice(0, 5); // Limit to 5 videos max to prevent timeouts

        return NextResponse.json({
            candidates: approvedVideos, // List of videos to process
            queries: keywords,
            debug: debugLog
        });

    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorStack = (e as any).stack;
        return NextResponse.json({ error: errorMessage, stack: errorStack }, { status: 500 });
    }
}
