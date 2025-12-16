import FirecrawlApp from '@mendable/firecrawl-js';
import dotenv from 'dotenv';

dotenv.config();

let firecrawlApp: FirecrawlApp | null = null;

function getFirecrawl() {
    if (!firecrawlApp) {
        if (!process.env.FIRECRAWL_API_KEY) {
            throw new Error("FIRECRAWL_API_KEY is missing. Please set it in your environment variables.");
        }
        firecrawlApp = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    }
    return firecrawlApp;
}

export interface ScrapeResult {
    url: string;
    markdown: string;
    metadata?: any;
    status: 'success' | 'failed';
    error?: string;
}

export async function scrapeFirecrawlV2(urls: string[]): Promise<ScrapeResult[]> {
    const app = getFirecrawl();
    const results: ScrapeResult[] = [];

    // Process one by one or in small batches to respect rate limits
    // Firecrawl is quite robust, but let's be safe with 3 concurrent
    const CHUNK_SIZE = 3;

    for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
        const chunk = urls.slice(i, i + CHUNK_SIZE);
        const promises = chunk.map(async (url) => {
            try {
                console.log(`🔥 Firecrawling: ${url}`);
                const scrapeResponse = await app.scrapeUrl(url, {
                    formats: ['markdown'],
                });

                if (!scrapeResponse.success) {
                    throw new Error(`Firecrawl failed: ${JSON.stringify(scrapeResponse.error)}`);
                }

                return {
                    url,
                    markdown: scrapeResponse.markdown || "",
                    metadata: scrapeResponse.metadata,
                    status: 'success'
                } as ScrapeResult;

            } catch (error) {
                console.error(`Failed to scrape ${url}:`, error);
                return {
                    url,
                    markdown: "",
                    status: 'failed',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    error: (error as any).message
                } as ScrapeResult;
            }
        });

        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
    }

    return results;
}
