import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60; // Extend Vercel Limit
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("Step 1 Error: GEMINI_API_KEY is missing");
            return NextResponse.json({ error: "Server Error: GEMINI_API_KEY is not set in environment variables." }, { status: 500 });
        }

        const { topic } = await req.json();
        const genAI = new GoogleGenerativeAI(apiKey);

        // Configure Grounding
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            tools: [
                // @ts-expect-error - The SDK types might be lagging behind the Gemini 2.0 update
                { googleSearch: {} }
            ]
        });

        const prompt = `Find the latest, most credible news stories from the last 24 hours regarding: ${topic}. Provide a detailed summary.`;
        const result = await model.generateContent(prompt);

        // Extract Sources
        const candidate = result.response.candidates?.[0];
        const metadata = candidate?.groundingMetadata;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sources = metadata?.groundingChunks?.map((chunk: any) => ({
            title: chunk.web?.title || "Source",
            url: chunk.web?.uri || "#"
        })) || [];

        return NextResponse.json({
            newsSummary: result.response.text(),
            sources: sources
        });
    } catch (error) {
        console.error("Step 1 Error Details:", error);

        // DEBUG: List available models
        let availableModels = "Could not fetch models";
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const listData = await listRes.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            availableModels = listData.models ? listData.models.map((m: any) => m.name).join(", ") : JSON.stringify(listData);
            console.log("DEBUG: Available Models:", availableModels);
        } catch (e) {
            console.error("Failed to list models:", e);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorMessage = error instanceof Error ? error.message : (error as any)?.toString();
        return NextResponse.json({
            error: `Step 1 Failed: ${errorMessage}`,
            availableModels: availableModels,
            details: JSON.stringify(error, Object.getOwnPropertyNames(error))
        }, { status: 500 });
    }
}
