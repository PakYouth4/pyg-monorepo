import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

let groq: Groq | null = null;

// ============ MODEL FALLBACK CHAINS ============
// For each use case, define ordered models (fast/cheap first, heavy last)
export const MODEL_CHAINS = {
    // Low complexity: Keywords, Queries
    KEYWORDS: [
        "llama-3.1-8b-instant",    // Fast, cheap
        "gemma2-9b-it",            // Backup
        "llama-3.3-70b-versatile"  // Heavy fallback
    ],
    // Medium complexity: Summarization, Structuring
    SUMMARIZE: [
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile"
    ],
    // High complexity: Classification, Verification
    CLASSIFY: [
        "llama-3.3-70b-versatile", // Needs reasoning power
        "llama-3.1-70b-versatile"  // Backup
    ],
    // Default fallback
    DEFAULT: [
        "llama-3.3-70b-versatile"
    ]
};

export function getGroqClient() {
    if (!groq) {
        if (!process.env.GROQ_API_KEY) {
            console.error("GROQ_API_KEY is missing!");
            throw new Error("GROQ_API_KEY is missing. Please add it to your environment variables.");
        }
        groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return groq;
}

// ============ GENERIC CALL WITH FALLBACK ============
interface GroqCallOptions {
    messages: Array<{ role: "user" | "system" | "assistant"; content: string }>;
    modelChain: string[];
    temperature?: number;
    jsonMode?: boolean;
}

export async function callGroqWithFallback(options: GroqCallOptions): Promise<string> {
    const groq = getGroqClient();
    const { messages, modelChain, temperature = 0.3, jsonMode = false } = options;

    for (const model of modelChain) {
        try {
            console.log(`[Groq] Trying model: ${model}`);

            const completion = await groq.chat.completions.create({
                messages,
                model,
                temperature,
                stream: false,
                ...(jsonMode ? { response_format: { type: "json_object" } } : {})
            });

            const content = completion.choices[0]?.message?.content || "";
            console.log(`[Groq] Success with model: ${model}`);
            return content;

        } catch (error: unknown) {
            const err = error as Error;
            console.warn(`[Groq] Model ${model} failed: ${err.message}`);

            // Check if it's a rate limit or quota error
            if (err.message?.includes("rate_limit") || err.message?.includes("quota")) {
                console.log(`[Groq] Rate limit hit, trying next model...`);
                continue;
            }

            // Check if model doesn't exist
            if (err.message?.includes("model_not_found") || err.message?.includes("does not exist")) {
                console.log(`[Groq] Model not found, trying next...`);
                continue;
            }

            // For other errors, try next model
            continue;
        }
    }

    throw new Error(`All models in chain failed: ${modelChain.join(", ")}`);
}

// ============ KEYWORD GENERATION (WITH FALLBACK) ============
export async function generateMetaKeywordsV2(topic: string): Promise<string[]> {
    const systemPrompt = `You are an OSINT research keyword specialist. You generate precise, searchable terms for finding news articles and video coverage about geopolitical topics. Output ONLY valid JSON arrays.`;

    const userPrompt = `<topic>${topic}</topic>

<task>
Generate exactly 10 search keywords/phrases for finding news and video coverage about this topic.
</task>

<requirements>
- Include 3-4 broad terms (e.g., "Gaza conflict", "Palestine crisis")
- Include 3-4 specific entities (names, organizations, locations)
- Include 2-3 event-specific terms (e.g., "hospital strike", "ceasefire talks")
- Each keyword: 1-4 words, searchable on Google/YouTube
- Prioritize terms likely to find RECENT news coverage
</requirements>

<format>
Output a JSON array of 10 strings. Nothing else.
</format>

<example>
Input topic: "Sudan Civil War 2024"
Output: ["Sudan civil war", "RSF Rapid Support Forces", "SAF Sudan Army", "Khartoum fighting", "Darfur crisis", "Al-Burhan", "Hemedti", "Sudan humanitarian crisis", "Port Sudan refugees", "Sudan ceasefire"]
</example>`;

    try {
        const content = await callGroqWithFallback({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            modelChain: MODEL_CHAINS.KEYWORDS,
            temperature: 0.4,
            jsonMode: true
        });

        // Robust JSON parsing
        try {
            const parsed = JSON.parse(content);
            let keywords: string[] = [];
            if (Array.isArray(parsed)) keywords = parsed;
            else if (parsed.keywords && Array.isArray(parsed.keywords)) keywords = parsed.keywords;
            else {
                // Iterate values to find array
                for (const key in parsed) {
                    if (Array.isArray(parsed[key])) {
                        keywords = parsed[key];
                        break;
                    }
                }
            }

            // Log keywords for quality review
            console.log(`[Keywords] Generated ${keywords.length} keywords for "${topic}":`);
            keywords.forEach((kw, i) => console.log(`  ${i + 1}. ${kw}`));

            return keywords;
        } catch (e) {
            console.warn("Groq JSON Parse Error:", e, content);
            // Fallback regex extract
            const match = content.match(/\[.*\]/s);
            if (match) return JSON.parse(match[0]);
            return [topic];
        }

    } catch (error) {
        console.error("Groq API Error (all models failed):", error);
        // Fallback to basic topic if all models fail
        return [topic, `${topic} news`, `${topic} analysis`];
    }
}
