import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';
import axios from 'axios';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Helper to scrape text from a URL
async function scrapeUrl(url: string): Promise<string> {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/'
            },
            timeout: 8000 // 8s timeout (reduced to be safe)
        });
        const $ = cheerio.load(data);

        // Remove junk
        $('script, style, nav, footer, header, aside, .ads, .advertisement').remove();

        // Get main text
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        return text.substring(0, 15000); // Limit to 15k chars to save tokens
    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        return "";
    }
}

export async function POST(req: Request) {
    try {
        const { newsSummary, sources } = await req.json();
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // 1. Identify Key URLs to Scrape
        // We take the top 3 sources from Step 1 (newsSummary context or explicit sources list)
        // For now, we'll just scrape the first 3 valid URLs from the 'sources' array.
        const urlsToScrape = sources.slice(0, 3);
        const scrapedContent = [];

        for (const url of urlsToScrape) {
            const content = await scrapeUrl(url);
            if (content.length > 500) {
                scrapedContent.push(`SOURCE: ${url}\nCONTENT:\n${content}\n---`);
            }
        }

        if (scrapedContent.length === 0) {
            return NextResponse.json({ deepAnalysis: "Could not scrape deep content. Relying on summary." });
        }

        // 2. Deep Analysis with Gemini
        const prompt = `
            ORIGINAL SUMMARY:
            "${newsSummary}"

            DEEP DIVE CONTENT (Full Text from Articles):
            ${scrapedContent.join("\n")}

            TASK:
            Analyze the Deep Dive Content.
            1. Find 3 specific facts, quotes, or numbers that were MISSING from the original summary.
            2. Verify if the original summary aligns with the deep text.
            3. Output a "Deep Insight" section.

            OUTPUT FORMAT:
            Markdown. Start with "### 🕵️‍♂️ Deep Research Findings".
        `;

        const result = await model.generateContent(prompt);
        const deepAnalysis = result.response.text();

        return NextResponse.json({ deepAnalysis });

    } catch (error) {
        console.error("Step 1.5 Error:", error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return NextResponse.json({ error: (error as any).message }, { status: 500 });
    }
}
