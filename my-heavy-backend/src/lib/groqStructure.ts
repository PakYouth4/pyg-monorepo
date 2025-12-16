import { callGroqWithFallback, MODEL_CHAINS } from './groq';
import dotenv from 'dotenv';

dotenv.config();

export interface StructuredSection {
    heading: string;
    content: string;
}

export interface StructuredArticle {
    id: number;
    url: string;
    publisher: string;
    sections: StructuredSection[];
}

export async function structureArticleGroq(markdown: string, url: string, index: number): Promise<StructuredArticle> {

    const prompt = `
        You are an elite Data Structuring Agent.
        
        TASK: Convert the following Markdown Article into a Strict JSON Object.
        
        INPUT METADATA:
        - Index ID: ${index}
        - URL: ${url}
        
        INPUT TEXT (MARKDOWN):
        """
        ${markdown.substring(0, 25000)} 
        """
        (Truncated to fit context window)

        INSTRUCTIONS:
        1. "publisher": Extract the news organization name (e.g., "BBC", "Reuters", "UN News").
        2. "sections": Divide the entire body text into logical sections based on the markdown headings or natural thematic breaks.
           - "heading": The section title (or "Introduction" for the first part).
           - "content": The full text of that section.
        3. IGNORE navigation menus, "Read more" links, ads, and footers. Only keep the core article text.
        4. "id": Use the provided Index ID (${index}).
        5. "url": Use the provided URL.

        CRITICAL: OUTPUT REQUEST
        - Return ONLY raw JSON. 
        - Do NOT include any markdown formatting like \`\`\`json or \`\`\`.
        - Ensure the output is a valid JSON object matching this structure:
        {
            "id": number,
            "url": "string",
            "publisher": "string",
            "sections": [ { "heading": "string", "content": "string" } ]
        }
    `;

    try {
        const text = await callGroqWithFallback({
            messages: [
                { role: "system", content: "You are a JSON-only API. Output strict JSON." },
                { role: "user", content: prompt }
            ],
            modelChain: MODEL_CHAINS.SUMMARIZE, // Medium complexity
            temperature: 0,
            jsonMode: true
        });

        return JSON.parse(text) as StructuredArticle;

    } catch (e) {
        console.error(`Groq Structure failed for ${url}:`, e);
        // Fallback or empty return
        return {
            id: index,
            url: url,
            publisher: "Unknown",
            sections: [{ heading: "Error", content: "Failed to structure content." }]
        };
    }
}
