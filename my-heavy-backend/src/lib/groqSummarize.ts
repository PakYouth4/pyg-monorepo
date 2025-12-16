import { callGroqWithFallback, MODEL_CHAINS, getGroqClient } from './groq';

export interface SummarizedArticle {
    id: number;
    url: string;
    publisher: string;
    headline_summary: string;
    summary_bullets: string[];
}

// 15,000 chars per chunk
const CHUNK_SIZE = 15000;

function chunkText(text: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.substring(i, i + CHUNK_SIZE));
    }
    return chunks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function summarizeArticleGroq(article: any): Promise<SummarizedArticle> {

    // 1. Reconstruct full text from sections
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullText = article.sections.map((s: any) => `## ${s.heading}\n${s.content}`).join("\n\n");

    const chunks = chunkText(fullText);
    const chunkSummaries: string[] = [];

    // 2. Summarize Chunks (Parallel) - Use SUMMARIZE chain (fast first)
    const promises = chunks.map(async (chunk, i) => {
        try {
            const prompt = `
                TASK: Summarize this text chunk into distinct, information-dense bullet points.
                - Focus on KEY FACTS, FIGURES, DATES, and NAMES.
                - Ignore boilerplate.
                - Output ONLY a bulleted list (Markdown "- ...").
                
                TEXT CHUNK (${i + 1}/${chunks.length}):
                """
                ${chunk}
                """
            `;

            const result = await callGroqWithFallback({
                messages: [{ role: "user", content: prompt }],
                modelChain: MODEL_CHAINS.SUMMARIZE,
                temperature: 0.3
            });

            return result;
        } catch (e) {
            console.error("Chunk summary failed:", e);
            return "";
        }
    });

    const results = await Promise.all(promises);
    const allBullets = results.join("\n");

    // 3. Final Merge & Headline (Use heavier model for synthesis)
    const finalPrompt = `
        TASK: Synthesize these bullet points into a Final Summary and a One-Sentence Headline.
        
        INPUT BULLETS:
        """
        ${allBullets.substring(0, 30000)}
        """

        OUTPUT FORMAT (Strict JSON):
        {
            "headline_summary": "A single, powerful sentence summarizing the core event.",
            "summary_bullets": [
                "Detailed bullet point 1 (rich with facts)",
                "Detailed bullet point 2",
                "...",
                "Detailed bullet point 7"
            ]
        }
        - Aim for 5-10 high-quality bullets.
        - Deduplicate information.
    `;

    try {
        const text = await callGroqWithFallback({
            messages: [
                { role: "system", content: "You are a JSON-only API." },
                { role: "user", content: finalPrompt }
            ],
            modelChain: MODEL_CHAINS.CLASSIFY, // Use heavier model for final merge
            temperature: 0.2,
            jsonMode: true
        });

        const parsed = JSON.parse(text);

        return {
            id: article.id,
            url: article.url,
            publisher: article.publisher,
            headline_summary: parsed.headline_summary || "Summary unavailable",
            summary_bullets: parsed.summary_bullets || []
        };

    } catch (e) {
        console.error("Final merge failed:", e);
        return {
            id: article.id,
            url: article.url,
            publisher: article.publisher,
            headline_summary: "Error generating summary",
            summary_bullets: ["Failed to summarize."]
        };
    }
}
