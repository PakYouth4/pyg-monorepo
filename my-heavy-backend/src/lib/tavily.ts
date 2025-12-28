import { tavily } from '@tavily/core';
import dotenv from 'dotenv';

dotenv.config();

// Initialize client properly using the factory function or constructor
// Depending on version, it might be `new TavilyClient` or `tavily({ key })`
// The official docs say: import { tavily } from '@tavily/core'; const tvly = tavily({ apiKey: '...' });

let tvly: any = null;

function getTavilyClient() {
    if (!tvly) {
        if (!process.env.TAVILY_API_KEY) {
            throw new Error("TAVILY_API_KEY is missing.");
        }
        tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
    }
    return tvly;
}

export interface SearchResult {
    title: string;
    url: string;
    content: string;
    published_date?: string;
    source: "tavily";
}

export async function searchTavilyV2(keywords: string[]): Promise<SearchResult[]> {
    const client = getTavilyClient();
    const allResults: SearchResult[] = [];
    const seenUrls = new Set<string>();

    console.log(`Starting Tavily search for ${keywords.length} keywords...`);

    // Parallel search with limit to avoid rate limits? 
    // Tavily is pretty fast. Let's do batches of 3.
    const BATCH_SIZE = 3;

    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
        const chunk = keywords.slice(i, i + BATCH_SIZE);
        const promises = chunk.map(async (query) => {
            try {
                const response = await client.search(query, {
                    search_depth: "basic", // "advanced" is more expensive, basic is fine for discovery
                    max_results: 5,
                    include_domains: [], // Add allowlist if needed
                    exclude_domains: ["youtube.com", "twitter.com", "facebook.com", "instagram.com"] // Focus on articles
                });
                return response.results; // Array of { title, url, content, published_date, ... }
            } catch (e) {
                console.error(`Tavily search failed for "${query}":`, e);
                return [];
            }
        });

        const results = await Promise.all(promises);

        results.flat().forEach((res: any) => {
            if (res && res.url && !seenUrls.has(res.url)) {
                seenUrls.add(res.url);
                allResults.push({
                    title: res.title,
                    url: res.url,
                    content: res.content,
                    published_date: res.published_date,
                    source: "tavily"
                });
            }
        });
    }

    // Log search results for quality review
    console.log(`[Search] Found ${allResults.length} unique articles:`);
    allResults.slice(0, 10).forEach((r, i) => console.log(`  ${i + 1}. ${r.title?.substring(0, 60)}... | ${r.url}`));
    if (allResults.length > 10) console.log(`  ... and ${allResults.length - 10} more`);

    return allResults;
}
