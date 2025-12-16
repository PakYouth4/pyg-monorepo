import { callGroqWithFallback, MODEL_CHAINS, getGroqClient } from './groq';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateVideoQueriesV2(topic: string, articleSummaries: any[]): Promise<string[]> {

    // 1. Prepare Context from Articles
    const context = articleSummaries.map((art, i) => `
    [Article ${i + 1}] ${art.headline_summary}
    Publisher: ${art.publisher}
    Key Facts:
    ${art.summary_bullets.join("\n")}
    `).join("\n\n");

    const prompt = `
    MAIN TOPIC: "${topic}"
    
    CONTEXT (What we know so far from News):
    """
    ${context}
    """

    TASK: Generate 10 NEW, HIGHLY SPECIFIC YouTube search queries to find visual evidence for this report.
    - These queries must be DIFFERENT from generic topic searches.
    - Use specific names, places, events, or phrases mentioned in the context.
    - Target "raw footage", "speech", "interview", "report", or "documentary" styles.
    - Do NOT mention "article" or "text". Look for VIDEO content.

    OUTPUT FORMAT (Strict JSON Array):
    ["query 1", "query 2", ..., "query 10"]
    `;

    try {
        const text = await callGroqWithFallback({
            messages: [
                { role: "system", content: "You are a JSON-only API." },
                { role: "user", content: prompt }
            ],
            modelChain: MODEL_CHAINS.KEYWORDS, // Use KEYWORDS chain (fast models)
            temperature: 0.4,
            jsonMode: true
        });

        // Robust JSON Parsing
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed;
            if (parsed.queries && Array.isArray(parsed.queries)) return parsed.queries;
            for (const key in parsed) {
                if (Array.isArray(parsed[key])) return parsed[key];
            }
            return [];
        } catch (e) {
            console.warn("Groq Query Gen JSON Error:", e);
            const match = text.match(/\[.*\]/s);
            if (match) return JSON.parse(match[0]);
            return [topic];
        }

    } catch (e) {
        console.error("Groq Query Gen failed:", e);
        return [`${topic} latest news`, `${topic} documentary`, `${topic} footage`];
    }
}
