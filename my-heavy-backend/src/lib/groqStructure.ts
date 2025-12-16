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

    const systemPrompt = `You are a news article parser. Extract structured data from raw article content. Output ONLY valid JSON matching the exact schema provided.`;

    const userPrompt = `<metadata>
ID: ${index}
URL: ${url}
</metadata>

<article>
${markdown.substring(0, 20000)}
</article>

<task>
Parse this article and extract structured sections.
</task>

<requirements>
- Extract publisher name from content/URL (e.g., "BBC", "Al Jazeera", "Reuters")
- Split content into logical sections based on headings or themes
- First section should be "Introduction" or main headline content
- EXCLUDE: navigation, ads, "Read more" links, footers
- KEEP: All substantive article text
</requirements>

<schema>
{
  "id": ${index},
  "url": "${url}",
  "publisher": "string",
  "sections": [
    {"heading": "string", "content": "string"}
  ]
}
</schema>`;

    try {
        const text = await callGroqWithFallback({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            modelChain: MODEL_CHAINS.SUMMARIZE,
            temperature: 0.1,
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
