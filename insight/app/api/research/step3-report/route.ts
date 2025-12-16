import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { newsSummary, deepAnalysis, sources, videos, queries, topic, reportId, isPublic, userId } = await req.json();
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // 1. Prepare Data Strings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const videosText = videos.map((v: any, i: number) => `[Video ${i + 1}] ${v.title} (${v.channel})\nTranscript: ${v.transcript}`).join("\n\n");

        // 2. Final Prompt (Enforcing Sources)
        const prompt = `
            SOURCE 1: NEWS SUMMARY
            ${newsSummary}

            SOURCE 1.5: DEEP DIVE FINDINGS (Full Text Analysis)
            ${deepAnalysis || "No deep analysis available."}
            
            SOURCE 2: VIDEOS
            ${videosText}
            
            TASK: Write a Deep Dive Intelligence Report on ${topic}.
            Include a section: ## 🔗 SOURCES listing the news links provided.
            
            STRUCTURE:
            # [URGENT/CATCHY TITLE]
            ## 🔍 THE OFFICIAL NARRATIVE (News)
            ## 🕵️‍♂️ DEEP DIVE INSIGHTS (Hidden Details found in full text)
            ## 👁️ ON THE GROUND (Video Evidence)
            ## 📱 SOCIAL PULSE (What's Viral)
            ## 🧠 AGENT'S ANALYSIS (Hidden Truths)
            ## 🔗 SOURCES (List the Verified News Links provided in Source 1)
            
            Keep it markdown formatted.
        `;

        const result = await model.generateContent(prompt);
        const finalReport = result.response.text();

        // Generate Ideas
        const ideasPrompt = `Based on this report:\n${finalReport}\nGenerate 3 viral Instagram Reel ideas that visualize these hidden truths.`;
        const ideasResult = await model.generateContent(ideasPrompt);
        const ideas = ideasResult.response.text();

        // 3. Save to Firestore
        const reportData = {
            summary: finalReport,
            ideas: ideas,
            status: 'completed',
            videoCount: videos.length,
            sources: sources,
            videos: videos, // Save full video data (including transcripts)
            queries: queries // Save search queries
        };

        let finalDocId = reportId;
        if (reportId) {
            const docRef = doc(db, "reports", reportId);
            await updateDoc(docRef, reportData);
        } else {
            const docRef = await addDoc(collection(db, "reports"), {
                ...reportData,
                topic: topic,
                date: Timestamp.now(),
                docUrl: "#",
                type: topic ? "manual" : "weekly",
                isPublic: isPublic || false,
                userId: userId,
                createdAt: Timestamp.now(),
            });
            finalDocId = docRef.id;
        }

        return NextResponse.json({ id: finalDocId, summary: finalReport });
    } catch (error) {
        console.error("Step 3 Error:", error);
        return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }
}
