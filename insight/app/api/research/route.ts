import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { YoutubeTranscript } from 'youtube-transcript';

// Allow up to 60 seconds for execution (Vercel Pro / Self-Hosted)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// --- CONFIGURATION ---
const MODEL_NAME = "gemini-2.0-flash";

// --- TYPES ---
interface Video {
    id: string;
    title: string;
    channel: string;
    description: string;
    transcript?: string;
}

// --- HELPER: Transcript Logic (Basic Version) ---
async function getTranscriptText(videoId: string): Promise<string> {
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        return transcript.map(t => t.text).join(" ");
    } catch (e) {
        console.log(`Transcript failed for ${videoId}`, e);
        return "(No transcript available - relying on metadata)";
    }
}

export async function POST(req: Request) {
    try {
        const { topic, regions, isPublic, reportId } = await req.json();

        // 1. Validate Keys
        const geminiKey = process.env.GEMINI_API_KEY;
        const youtubeKey = process.env.YOUTUBE_API_KEY;

        if (!geminiKey || !youtubeKey) {
            return NextResponse.json({
                status: 'error',
                message: 'Server Configuration Error: Missing API Keys.'
            }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            tools: [{
                // @ts-expect-error - The SDK types might be lagging behind the Gemini 2.0 update
                googleSearch: {},
            }],
        });

        // 2. Setup Query
        let regionKeywords: string[] = [];
        if (regions) {
            if (regions.pakistan) regionKeywords.push("Pakistan");
            if (regions.palestine) regionKeywords.push("Palestine/Gaza");
            if (regions.worldwide) regionKeywords.push("Global Muslim Issues");
        }
        if (regionKeywords.length === 0) regionKeywords = ["Global News"];
        const userQuery = topic || regionKeywords.join(" and ");

        // PHASE 1: NEWS
        const newsPrompt = `Find the latest news stories (last 24h) regarding: ${userQuery}. Provide a summary.`;
        const newsResult = await model.generateContent(newsPrompt);
        const newsSummary = newsResult.response.text();

        // Extract Sources
        const metadata = newsResult.response.candidates?.[0]?.groundingMetadata;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newsSources = metadata?.groundingChunks?.map((chunk: any) => ({
            title: chunk.web?.title || "Source",
            url: chunk.web?.uri || "#",
        })) || [];

        // PHASE 2: VIDEO SEARCH
        const queryPrompt = `Based on: ${newsSummary}\nGenerate 2 YouTube search queries. Return one per line.`;
        const queryResult = await model.generateContent(queryPrompt);
        const queries = queryResult.response.text().split("\n").filter(l => l.trim().length > 0).slice(0, 2);

        const videos: Video[] = [];
        const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Sequential Loop for Safety
        for (const q of queries) {
            try {
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&maxResults=2&order=viewCount&type=video&publishedAfter=${oneMonthAgo}&key=${youtubeKey}`;
                const res = await fetch(searchUrl);
                const data = await res.json();

                if (data.items) {
                    for (const item of data.items) {
                        const txt = await getTranscriptText(item.id.videoId);
                        videos.push({
                            id: item.id.videoId,
                            title: item.snippet.title,
                            channel: item.snippet.channelTitle,
                            description: item.snippet.description,
                            transcript: txt
                        });
                    }
                }
            } catch (e) {
                console.error("Search error", e);
            }
        }

        const uniqueVideos = Array.from(new Map(videos.map(v => [v.id, v])).values()).slice(0, 5);

        // PHASE 3: INSTAGRAM
        const instaPrompt = `Based on: ${newsSummary}\nSuggest 3 viral Instagram hashtags.`;
        const instaResult = await model.generateContent(instaPrompt);
        const instaTrends = instaResult.response.text();

        // PHASE 4: REPORT
        const videosText = uniqueVideos.map((v, i) => `[Video ${i + 1}] ${v.title} (${v.channel})\n${v.transcript}`).join("\n");
        const summaryPrompt = `
            NEWS: ${newsSummary}
            VIDEOS: ${videosText}
            TRENDS: ${instaTrends}
            
            TASK: Write a Deep Dive Intelligence Report.
            Include a section: ## 🔗 SOURCES listing the news links provided.
        `;
        const summaryResult = await model.generateContent(summaryPrompt);
        const finalReport = summaryResult.response.text();

        // PHASE 5: IDEAS
        const ideasPrompt = `Based on this report, generate 3 viral Content Ideas.`;
        const ideasResult = await model.generateContent(ideasPrompt);
        const ideas = ideasResult.response.text();

        // SAVE TO FIRESTORE
        let finalDocId = reportId;
        const reportData = {
            summary: finalReport,
            ideas: ideas,
            status: 'completed',
            videoCount: uniqueVideos.length,
            sources: newsSources
        };

        if (reportId) {
            const docRef = doc(db, "reports", reportId);
            await updateDoc(docRef, reportData);
        } else {
            const docRef = await addDoc(collection(db, "reports"), {
                ...reportData,
                date: Timestamp.now(),
                docUrl: "#",
                type: topic ? "manual" : "weekly",
                topic: topic || "General",
                isPublic: isPublic || false,
                createdAt: Timestamp.now(),
            });
            finalDocId = docRef.id;
        }

        // ✅ RETURN IS NOW CORRECTLY INSIDE THE TRY BLOCK
        return NextResponse.json({
            status: 'success',
            data: {
                id: finalDocId,
                summary: finalReport,
                ideas,
                videoCount: uniqueVideos.length,
                firestore: { success: true, log: "Saved to Firestore" }
            }
        });

    } catch (error: unknown) {
        console.error("Research Agent Error:", error instanceof Error ? error.message : error);
        return NextResponse.json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Internal Server Error'
        }, { status: 500 });
    }
}
