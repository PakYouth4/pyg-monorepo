import { callGroqWithFallback, MODEL_CHAINS, getGroqClient } from './groq';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateVideoQueriesV2(topic: string, articleSummaries: any[]): Promise<string[]> {

    // 1. Prepare Context from Articles
    const context = articleSummaries.map((art, i) =>
        `[${i + 1}] ${art.headline_summary} (${art.publisher})`
    ).join("\n");

    const systemPrompt = `You are a YouTube search specialist. Generate precise video search queries to find news footage, interviews, and documentaries. Output ONLY valid JSON arrays.`;

    const userPrompt = `<topic>${topic}</topic>

<context>
${context}
</context>

<task>
Generate 10 YouTube search queries to find VIDEO coverage of this topic.
</task>

<requirements>
- Use specific names, places, events from the context
- Mix of: "raw footage", "interview", "news report", "documentary"
- Each query: 2-5 words, optimized for YouTube search
- NO generic queries like just the topic name
- Target RECENT coverage
</requirements>

<format>
Output a JSON array of 10 strings. Nothing else.
</format>

<example>
Topic: "Gaza Hospital Strike"
Output: ["Al-Ahli hospital strike footage", "Gaza hospital attack interview", "IDF statement hospital", "WHO Gaza hospital response", ...]
</example>`;

    try {
        const text = await callGroqWithFallback({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            modelChain: MODEL_CHAINS.KEYWORDS,
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
