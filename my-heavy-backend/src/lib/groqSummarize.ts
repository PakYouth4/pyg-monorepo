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

    // 2. Summarize Chunks (Parallel)
    const chunkSystemPrompt = `You are a news summarizer. Extract key facts as bullet points. Be concise and factual.`;

    const promises = chunks.map(async (chunk, i) => {
        try {
            const chunkPrompt = `<chunk index="${i + 1}" total="${chunks.length}">
${chunk}
</chunk>

<task>Extract 3-5 key facts from this text chunk as bullet points.</task>

<requirements>
- Focus on: dates, numbers, names, events, quotes
- Ignore: boilerplate, navigation, repetition
- Format: Markdown bullets (- fact)
</requirements>`;

            const result = await callGroqWithFallback({
                messages: [
                    { role: "system", content: chunkSystemPrompt },
                    { role: "user", content: chunkPrompt }
                ],
                modelChain: MODEL_CHAINS.SUMMARIZE,
                temperature: 0.2
            });

            return result;
        } catch (e) {
            console.error("Chunk summary failed:", e);
            return "";
        }
    });

    const results = await Promise.all(promises);
    const allBullets = results.join("\n");

    // 3. Final Merge & Headline
    const mergeSystemPrompt = `You are a news editor. Synthesize bullet points into a cohesive summary. Output ONLY valid JSON.`;

    const mergePrompt = `<bullets>
${allBullets.substring(0, 25000)}
</bullets>

<task>Create a headline and 5-10 summary bullet points from these notes.</task>

<requirements>
- headline_summary: One powerful sentence capturing the core story
- summary_bullets: 5-10 distinct, fact-rich bullet points
- Deduplicate overlapping information
- Prioritize most newsworthy facts
</requirements>

<schema>
{
  "headline_summary": "string",
  "summary_bullets": ["string", "string", ...]
}
</schema>`;

    try {
        const text = await callGroqWithFallback({
            messages: [
                { role: "system", content: mergeSystemPrompt },
                { role: "user", content: mergePrompt }
            ],
            modelChain: MODEL_CHAINS.CLASSIFY,
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
