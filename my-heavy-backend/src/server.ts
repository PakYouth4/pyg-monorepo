import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { db } from './lib/firebase';
import { getSmartTranscript } from './lib/youtubeHelper';
import { generateMetaKeywordsV2 } from './lib/groq';
import { searchTavilyV2 } from './lib/tavily';
import { scrapeFirecrawlV2 } from './lib/firecrawl';
import { structureArticleGroq } from './lib/groqStructure';
import { summarizeArticleGroq } from './lib/groqSummarize';
import { generateVideoQueriesV2 } from './lib/groqQueryGenerator';
import { searchYouTubeV2 } from './lib/youtubeSearch';
import { processVideosInParallel } from './lib/groqTranscribe';
import { verifyVideosGroq } from './lib/groqVerify';
import { classifyVideosGroq, filterKeptVideos } from './lib/groqClassify';
import { mergeKnowledgeBase, enrichSourcesWithGroq } from './lib/knowledgeBase';
import { normalizeSources } from './lib/groqNormalize';
import { storeSourceEmbeddings, semanticSearch, findSimilarResearch, getResearchHistory } from './lib/embeddings';
import { runDeepAnalysis } from './lib/groqDeepAnalysis';
import { generateContentIdeas } from './lib/groqContentIdeas';
import { assembleReport } from './lib/reportAssembler';
import { runPreflightChecks } from './lib/utils';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 7860; // Hugging Face Spaces default port

// --- HEALTH CHECK ---
app.get('/', (req, res) => {
    res.send('Heavy Backend V5.2 (Optimized LLM Usage) Online 🚀');
});

// --- PREFLIGHT CHECK ---
app.get('/v2/preflight', async (req, res) => {
    try {
        const result = await runPreflightChecks();
        res.json(result);
    } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ canProceed: false, error: (e as any).message });
    }
});

// ... (omitted)

// --- V2: STEP 8 (TRANSCRIBE) ---
app.post('/v2/step8-transcribe', async (req, res) => {
    try {
        const { videos } = req.body; // Array of VideoResult
        if (!videos || !Array.isArray(videos)) {
            return res.status(400).json({ error: "Videos array is required" });
        }

        console.log(`Transcribing ${videos.length} videos...`);

        const transcribedVideos = await processVideosInParallel(videos);
        res.json({ videos: transcribedVideos });

    } catch (e) {
        console.error("V2 Step 8 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 9 (VERIFY) ---
app.post('/v2/step9-verify', async (req, res) => {
    try {
        const { topic, videos, articles } = req.body;

        if (!topic || !videos || !articles) {
            return res.status(400).json({ error: "Topic, Videos, and Articles are required" });
        }

        console.log(`Verifying ${videos.length} videos against ${articles.length} articles...`);

        // Consolidate article context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const articleContext = articles.map((a: any) =>
            `HEADLINE: ${a.headline_summary}\nBULLETS:\n${a.summary_bullets.join("\n")}`
        ).join("\n\n");

        const verifiedVideos = await verifyVideosGroq(topic, videos, articleContext);

        console.log(`Verification Complete. Kept ${verifiedVideos.length}/${videos.length} videos.`);

        res.json({ videos: verifiedVideos });

    } catch (e) {
        console.error("V2 Step 9 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 9 (CLASSIFY) ---
app.post('/v2/step9-classify', async (req, res) => {
    try {
        const { topic, videos, threshold } = req.body;

        if (!topic || !videos || !Array.isArray(videos)) {
            return res.status(400).json({ error: "Topic and Videos array are required" });
        }

        console.log(`Classifying ${videos.length} videos for topic "${topic}"...`);

        const classifiedVideos = await classifyVideosGroq(topic, videos);
        const keptVideos = filterKeptVideos(classifiedVideos, threshold || 50);

        console.log(`Classification Complete. Kept ${keptVideos.length}/${videos.length} videos.`);

        res.json({
            all_videos: classifiedVideos,
            kept_videos: keptVideos,
            stats: {
                total: classifiedVideos.length,
                kept: keptVideos.length,
                rejected: classifiedVideos.length - keptVideos.length
            }
        });

    } catch (e) {
        console.error("V2 Step 9 Classify Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 9 (MERGE KNOWLEDGE BASE) ---
app.post('/v2/step9-merge', async (req, res) => {
    try {
        const { topic, articles, videos, enrich } = req.body;

        if (!articles && !videos) {
            return res.status(400).json({ error: "At least one of articles or videos is required" });
        }

        console.log(`Merging knowledge base: ${articles?.length || 0} articles, ${videos?.length || 0} videos`);

        // Merge into unified format
        const merged = mergeKnowledgeBase({ articles, videos });

        // Optional: Enrich with Groq (generate key_facts for sources that lack them)
        let sources = merged.sources;
        if (enrich && topic) {
            console.log("Enriching sources with Groq...");
            sources = await enrichSourcesWithGroq(topic, sources);
        }

        console.log(`Merge Complete. Total sources: ${sources.length}`);

        res.json({
            sources,
            stats: merged.stats
        });

    } catch (e) {
        console.error("V2 Step 9 Merge Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 10 (NORMALIZE SOURCES) ---
app.post('/v2/step10-normalize', async (req, res) => {
    try {
        const { topic, articles, videos } = req.body;

        if (!topic) {
            return res.status(400).json({ error: "Topic is required" });
        }

        if (!articles && !videos) {
            return res.status(400).json({ error: "At least one of articles or videos is required" });
        }

        console.log(`Normalizing sources: ${articles?.length || 0} articles, ${videos?.length || 0} videos`);

        const result = await normalizeSources(articles || [], videos || [], topic);

        console.log(`Normalization Complete. Total sources: ${result.sources.length}`);

        res.json(result);

    } catch (e) {
        console.error("V2 Step 10 Normalize Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 11 (DEEP ANALYSIS) ---
app.post('/v2/step11-analyze', async (req, res) => {
    try {
        const { topic, sources } = req.body;

        if (!topic || !sources || !Array.isArray(sources)) {
            return res.status(400).json({ error: "Topic and sources array are required" });
        }

        console.log(`Running deep analysis for "${topic}" with ${sources.length} sources...`);

        const analysis = await runDeepAnalysis(topic, sources);

        console.log(`Deep Analysis Complete. Grade: ${analysis.quality_metrics.confidence_grade}`);

        res.json(analysis);

    } catch (e) {
        console.error("V2 Step 11 Analyze Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 12 (CONTENT IDEAS) ---
app.post('/v2/step12-content', async (req, res) => {
    try {
        const { analysis } = req.body;

        if (!analysis || !analysis.topic) {
            return res.status(400).json({ error: "Deep analysis object is required" });
        }

        console.log(`Generating content ideas for "${analysis.topic}"...`);

        const contentIdeas = await generateContentIdeas(analysis);

        console.log(`Generated ${contentIdeas.stats.total_ideas} content ideas`);

        res.json(contentIdeas);

    } catch (e) {
        console.error("V2 Step 12 Content Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 13 (ASSEMBLE FINAL REPORT) ---
app.post('/v2/step13-report', async (req, res) => {
    try {
        const { topic, sources, deep_analysis, content_ideas, executive_summary } = req.body;

        if (!topic || !sources || !deep_analysis || !content_ideas) {
            return res.status(400).json({
                error: "Required: topic, sources, deep_analysis, content_ideas"
            });
        }

        console.log(`Assembling final report for "${topic}"...`);

        const report = assembleReport({
            topic,
            executive_summary,
            sources,
            deep_analysis,
            content_ideas
        });

        console.log(`Report assembled. ID: ${report.report_id}, Grade: ${report.quality_check.grade}`);

        res.json(report);

    } catch (e) {
        console.error("V2 Step 13 Report Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- EMBEDDINGS: STORE ---
app.post('/v2/embeddings/store', async (req, res) => {
    try {
        const { sources, topic } = req.body;

        if (!sources || !Array.isArray(sources) || !topic) {
            return res.status(400).json({ error: "Sources array and topic are required" });
        }

        console.log(`Storing ${sources.length} source embeddings for topic "${topic}"...`);

        // Transform to embedding input format
        const embeddingInputs = sources.map((s: { id: string; type: string; title: string; url: string; summary: string; metadata?: Record<string, unknown> }) => ({
            source_id: s.id,
            source_type: s.type as 'article' | 'video',
            topic: topic,
            title: s.title,
            url: s.url,
            summary: s.summary,
            metadata: s.metadata || {}
        }));

        const result = await storeSourceEmbeddings(embeddingInputs);

        res.json({
            success: true,
            ...result
        });

    } catch (e) {
        console.error("Embeddings Store Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- EMBEDDINGS: SEARCH ---
app.post('/v2/embeddings/search', async (req, res) => {
    try {
        const { query, topic, limit, minSimilarity } = req.body;

        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }

        console.log(`Semantic search for: "${query.slice(0, 50)}..."`);

        const results = await semanticSearch(query, {
            limit: limit || 10,
            topic,
            minSimilarity: minSimilarity || 0.5
        });

        res.json({
            results,
            count: results.length
        });

    } catch (e) {
        console.error("Embeddings Search Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- EMBEDDINGS: CHECK SIMILAR ---
app.post('/v2/embeddings/check-similar', async (req, res) => {
    try {
        const { topic, summary, limit } = req.body;

        if (!topic || !summary) {
            return res.status(400).json({ error: "Topic and summary are required" });
        }

        console.log(`Checking for similar past research on: "${topic}"`);

        const result = await findSimilarResearch(topic, summary, limit || 5);

        res.json(result);

    } catch (e) {
        console.error("Embeddings Check Similar Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- EMBEDDINGS: HISTORY ---
app.get('/v2/embeddings/history/:topic', async (req, res) => {
    try {
        const { topic } = req.params;

        if (!topic) {
            return res.status(400).json({ error: "Topic is required" });
        }

        console.log(`Fetching research history for: "${topic}"`);

        const history = await getResearchHistory(topic);

        res.json({
            topic,
            count: history.length,
            sources: history
        });

    } catch (e) {
        console.error("Embeddings History Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- STEP 1: NEWS ---

// ... (omitted)

// --- V2: STEP 7 (VIDEOS) ---
app.post('/v2/step7-videos', async (req, res) => {
    try {
        const { queries } = req.body; // Array of strings
        if (!queries || !Array.isArray(queries) || queries.length === 0) {
            return res.status(400).json({ error: "Queries array is required" });
        }

        console.log(`Searching YouTube for ${queries.length} queries...`);

        const videos = await searchYouTubeV2(queries);
        res.json({ videos });

    } catch (e) {
        console.error("V2 Step 7 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 8 (TRANSCRIBE) ---
app.post('/v2/step8-transcribe', async (req, res) => {
    try {
        const { videos } = req.body; // Array of VideoResult
        if (!videos || !Array.isArray(videos)) {
            return res.status(400).json({ error: "Videos array is required" });
        }

        console.log(`Transcribing ${videos.length} videos...`);

        const transcribedVideos = await processVideosInParallel(videos);
        res.json({ videos: transcribedVideos });

    } catch (e) {
        console.error("V2 Step 8 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- STEP 1: NEWS ---

// ... (omitted)

// --- V2: STEP 6 (QUERIES) ---
app.post('/v2/step6-queries', async (req, res) => {
    try {
        const { topic, articles } = req.body; // Topic + Array of SummarizedArticles
        if (!topic || !articles || !Array.isArray(articles)) {
            return res.status(400).json({ error: "Topic and Articles array are required" });
        }

        console.log(`Generating video queries for "${topic}" based on ${articles.length} articles...`);

        const queries = await generateVideoQueriesV2(topic, articles);
        res.json({ queries });

    } catch (e) {
        console.error("V2 Step 6 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 7 (VIDEOS) ---
app.post('/v2/step7-videos', async (req, res) => {
    try {
        const { queries } = req.body; // Array of strings
        if (!queries || !Array.isArray(queries) || queries.length === 0) {
            return res.status(400).json({ error: "Queries array is required" });
        }

        console.log(`Searching YouTube for ${queries.length} queries...`);

        const videos = await searchYouTubeV2(queries);
        res.json({ videos });

    } catch (e) {
        console.error("V2 Step 7 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- STEP 1: NEWS ---

// ... (omitted code)

// --- V2: STEP 5 (SUMMARIZE) ---
// (omitted)

// --- V2: STEP 6 (QUERIES) ---
app.post('/v2/step6-queries', async (req, res) => {
    try {
        const { topic, articles } = req.body; // Topic + Array of SummarizedArticles
        if (!topic || !articles || !Array.isArray(articles)) {
            return res.status(400).json({ error: "Topic and Articles array are required" });
        }

        console.log(`Generating video queries for "${topic}" based on ${articles.length} articles...`);

        const queries = await generateVideoQueriesV2(topic, articles);
        res.json({ queries });

    } catch (e) {
        console.error("V2 Step 6 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- STEP 1: NEWS ---

app.get('/version', (req, res) => {
    res.json({ version: "2.0.0", features: ["Groq", "V2 Layout"] });
});

// --- V2: STEP 1 (KEYWORDS) ---
// ... (existing code checked)
app.post('/v2/step1-keywords', async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic) return res.status(400).json({ error: "Topic is required" });

        const keywords = await generateMetaKeywordsV2(topic);
        res.json({ keywords });
    } catch (e) {
        console.error("V2 Step 1 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 2 (SEARCH) ---
app.post('/v2/step2-search', async (req, res) => {
    try {
        const { keywords } = req.body;
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({ error: "Keywords array is required" });
        }

        const results = await searchTavilyV2(keywords);
        res.json({ results });
    } catch (e) {
        console.error("V2 Step 2 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 3 (SCRAPE) ---
app.post('/v2/step3-scrape', async (req, res) => {
    try {
        const { urls } = req.body;
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ error: "URLs array is required" });
        }

        const results = await scrapeFirecrawlV2(urls);
        res.json({ results });
    } catch (e) {
        console.error("V2 Step 3 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 4 (STRUCTURE) ---
app.post('/v2/step4-structure', async (req, res) => {
    try {
        const { articles } = req.body; // Array of { markdown, url }
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ error: "Articles array is required" });
        }

        console.log(`Structuring ${articles.length} articles via Groq...`);

        // Process in parallel
        const promises = articles.map((art, index) =>
            structureArticleGroq(art.markdown, art.url, index + 1)
        );

        const structuredArticles = await Promise.all(promises);
        res.json({ articles: structuredArticles });

    } catch (e) {
        console.error("V2 Step 4 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- V2: STEP 5 (SUMMARIZE) ---
app.post('/v2/step5-summarize', async (req, res) => {
    try {
        const { articles } = req.body; // Array of StructuredArticles
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ error: "Articles array is required" });
        }

        console.log(`Summarizing ${articles.length} articles via Groq...`);

        // Process in parallel
        const promises = articles.map((art) => summarizeArticleGroq(art));
        const summarizedArticles = await Promise.all(promises);

        res.json({ articles: summarizedArticles });

    } catch (e) {
        console.error("V2 Step 5 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- STEP 1: NEWS ---
app.post('/step1-news', async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic) {
            return res.status(400).json({ error: "Topic is required" });
        }

        console.log(`[Step 1] Searching news for: ${topic}`);

        // Use Tavily for news search
        const { searchTavilyV2 } = await import('./lib/tavily');

        // Generate search keywords from topic
        const searchQueries = [
            `${topic} latest news`,
            `${topic} breaking news today`,
            `${topic} recent updates`
        ];

        const searchResults = await searchTavilyV2(searchQueries);

        if (searchResults.length === 0) {
            return res.json({
                newsSummary: `No recent news found for topic: ${topic}`,
                sources: []
            });
        }

        // Tavily already provides summarized content - no need for LLM here!
        // Just combine the snippets into a readable summary
        const newsSummary = searchResults.slice(0, 10).map(r =>
            `**${r.title}**\n${r.content}`
        ).join('\n\n---\n\n');

        const sources = searchResults.slice(0, 10).map(r => ({
            title: r.title,
            url: r.url
        }));

        console.log(`[Step 1] Found ${searchResults.length} articles from Tavily`);

        res.json({
            newsSummary: newsSummary,
            sources: sources
        });
    } catch (error) {
        console.error("Step 1 Error:", error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (error as any).message });
    }
});

// --- STEP 1.5: DEEP RESEARCH ---
async function scrapeUrl(url: string): Promise<string> {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/'
            },
            timeout: 8000
        });
        const $ = cheerio.load(data);
        $('script, style, nav, footer, header, aside, .ads, .advertisement').remove();
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        return text.substring(0, 15000);
    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        return "";
    }
}

app.post('/step1-5-deep', async (req, res) => {
    try {
        const { newsSummary, sources } = req.body;

        if (!sources || !Array.isArray(sources) || sources.length === 0) {
            return res.json({ deepAnalysis: "No sources provided for deep research." });
        }

        // Import Firecrawl for reliable scraping
        const { scrapeFirecrawlV2 } = await import('./lib/firecrawl');
        // Import our LLM provider
        const { callLLM } = await import('./lib/llmProvider');

        console.log(`[Step 1.5] Scraping ${Math.min(sources.length, 3)} URLs with Firecrawl...`);

        // Extract URLs from sources (can be strings or objects with .url)
        const urlsToScrape = sources.slice(0, 3).map((s: any) =>
            typeof s === 'string' ? s : s.url
        ).filter(Boolean);

        if (urlsToScrape.length === 0) {
            return res.json({ deepAnalysis: "No valid URLs to scrape." });
        }

        // Use Firecrawl for reliable scraping
        const scrapeResults = await scrapeFirecrawlV2(urlsToScrape);

        const scrapedContent: string[] = [];
        for (const result of scrapeResults) {
            if (result.status === 'success' && result.markdown.length > 500) {
                scrapedContent.push(`SOURCE: ${result.url}\nCONTENT:\n${result.markdown.substring(0, 8000)}\n---`);
            }
        }

        console.log(`[Step 1.5] Successfully scraped ${scrapedContent.length}/${urlsToScrape.length} articles`);

        if (scrapedContent.length === 0) {
            return res.json({ deepAnalysis: "Could not scrape deep content. Relying on summary." });
        }

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

        const result = await callLLM({
            task: 'DEEP_ANALYSIS',
            messages: [
                { role: 'system', content: 'You are an investigative journalist who digs deeper into news stories.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3
        });

        res.json({ deepAnalysis: result });

    } catch (error) {
        console.error("Step 1.5 Error:", error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (error as any).message });
    }
});

// --- STEP 2: VIDEOS ---
app.post('/step2-videos', async (req, res) => {
    try {
        const { newsSummary } = req.body;

        // Import our LLM provider
        const { callLLM } = await import('./lib/llmProvider');

        const debugLog = [];

        // Step 2a: Generate keywords using LLM
        const keywordPrompt = `
            NEWS CONTEXT: "${newsSummary}"
            TASK: Generate 5 BROAD, SINGLE-WORD SEO tags to find video footage.
            RULES:
            1. ONE WORD ONLY per tag.
            2. USE NOUNS.
            3. NO ABSTRACT CONCEPTS.
            4. MUST be high-volume search terms.
            OUTPUT: Return ONLY a JSON array of strings. Example: ["Gaza", "Rafah", "IDF", "UNRWA", "Egypt"]
        `;

        const keywordResult = await callLLM({
            task: 'KEYWORDS',
            messages: [
                { role: 'system', content: 'You generate SEO keywords for YouTube searches. Return ONLY valid JSON arrays.' },
                { role: 'user', content: keywordPrompt }
            ],
            temperature: 0.3,
            jsonMode: true
        });

        let keywords: string[] = [];
        try {
            const parsed = JSON.parse(keywordResult);
            // Ensure it's actually an array
            if (Array.isArray(parsed)) {
                keywords = parsed;
            } else if (typeof parsed === 'object' && parsed.keywords) {
                // Handle {keywords: [...]} format
                keywords = parsed.keywords;
            } else {
                throw new Error('Parsed result is not an array');
            }
        } catch (parseError) {
            console.error('[Step 2] Failed to parse keywords JSON:', parseError);
            console.log('[Step 2] Raw LLM response:', keywordResult);
            // Fallback: extract words from response using regex
            const words = keywordResult.match(/["']?(\w{3,})["']?/g);
            if (words && words.length > 0) {
                keywords = words.slice(0, 5).map(w => w.replace(/["']/g, ''));
            } else {
                // Ultimate fallback: extract topic words from newsSummary
                const topicWords = newsSummary.match(/\b[A-Z][a-z]{3,}\b/g) || [];
                keywords = topicWords.slice(0, 5).length > 0
                    ? topicWords.slice(0, 5)
                    : ['news', 'update', 'breaking', 'latest', 'today'];
            }
        }

        // Final safety: ensure keywords is always an array with at least one item
        if (!Array.isArray(keywords) || keywords.length === 0) {
            keywords = ['news', 'update', 'breaking'];
        }

        debugLog.push(`🔍 SEO Terms Generated: ${JSON.stringify(keywords)}`);

        // Step 2b: Search YouTube using YouTube Data API
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let candidates: any[] = [];

        for (const word of keywords) {
            try {
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(word)}&maxResults=3&type=video&order=date&key=${process.env.YOUTUBE_API_KEY}`;
                const apiRes = await axios.get(searchUrl);
                const data = apiRes.data;

                if (data.items) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const found = data.items.map((item: any) => ({
                        id: item.id.videoId,
                        title: item.snippet.title,
                        channel: item.snippet.channelTitle,
                        description: item.snippet.description,
                        foundByKeyword: word
                    }));
                    candidates = [...candidates, ...found];
                }
            } catch (e) {
                console.error("YouTube API search error:", e);
            }
        }

        candidates = Array.from(new Map(candidates.map(c => [c.id, c])).values());
        debugLog.push(`📥 Total Candidates Found: ${candidates.length}`);

        if (candidates.length === 0) {
            return res.json({ videos: [], queries: keywords, debug: debugLog });
        }

        // Step 2c: Filter videos using LLM
        const filterPrompt = `
            ORIGINAL NEWS STORY: "${newsSummary}"
            CANDIDATE VIDEOS: ${JSON.stringify(candidates.map(c => ({
            id: c.id,
            title: c.title,
            desc: c.description.substring(0, 150)
        })))}
            TASK: Evaluate EACH video. Is it relevant to the news story?
            OUTPUT: Return ONLY a JSON array of objects with "id", "isRelevant" (boolean), "reason" (string).
        `;

        const filterResult = await callLLM({
            task: 'CLASSIFY',
            messages: [
                { role: 'system', content: 'You classify video relevance. Return ONLY valid JSON arrays.' },
                { role: 'user', content: filterPrompt }
            ],
            temperature: 0.2,
            jsonMode: true
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let evaluations: any[] = [];
        try {
            const parsed = JSON.parse(filterResult);
            // Ensure it's actually an array
            if (Array.isArray(parsed)) {
                evaluations = parsed;
            } else if (typeof parsed === 'object' && Array.isArray(parsed.evaluations)) {
                evaluations = parsed.evaluations;
            } else if (typeof parsed === 'object' && Array.isArray(parsed.results)) {
                evaluations = parsed.results;
            } else {
                throw new Error('Parsed result is not an array');
            }
        } catch (parseError) {
            console.error('[Step 2] Failed to parse evaluations JSON:', parseError);
            console.log('[Step 2] Raw LLM response:', filterResult);
            // Fallback: keep all videos if parsing fails
            evaluations = candidates.map(c => ({ id: c.id, isRelevant: true }));
        }

        // Final safety check
        if (!Array.isArray(evaluations) || evaluations.length === 0) {
            evaluations = candidates.map(c => ({ id: c.id, isRelevant: true }));
        }

        const validIds = evaluations.filter(e => e.isRelevant).map(e => e.id);

        debugLog.push(`✅ AI Evaluated ${evaluations.length} videos. Approved: ${validIds.length}`);

        const approvedVideos = candidates.filter(c => validIds.includes(c.id)).slice(0, 5);

        res.json({
            candidates: approvedVideos,
            queries: keywords,
            debug: debugLog
        });

    } catch (e) {
        console.error("Step 2 Error:", e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (e as any).message });
    }
});

// --- STEP 2.5: TRANSCRIPTS ---
app.post('/step2-5-transcript', async (req, res) => {
    try {
        const { videoId, videoTitle, videoChannel, videoDescription, foundByKeyword } = req.body;

        if (!videoId) {
            return res.status(400).json({ error: "videoId is required" });
        }

        let transcript = "";
        try {
            transcript = await getSmartTranscript(videoId);
        } catch (error) {
            console.warn(`Failed to get transcript for ${videoId}:`, error);
            transcript = `(Transcript unavailable. Using Description): ${videoDescription}`;
        }

        res.json({
            video: {
                id: videoId,
                title: videoTitle,
                channel: videoChannel,
                description: videoDescription,
                foundByKeyword: foundByKeyword,
                transcript: transcript
            }
        });

    } catch (error) {
        console.error("Step 2.5 Error:", error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.status(500).json({ error: (error as any).message });
    }
});

// --- STEP 3: REPORT ---
app.post('/step3-report', async (req, res) => {
    try {
        const { newsSummary, deepAnalysis, sources, videos, queries, topic, reportId, isPublic, userId } = req.body;

        console.log(`[Step 3] Generating report for topic: ${topic}, reportId: ${reportId}`);

        // Import our LLM provider
        const { callLLM } = await import('./lib/llmProvider');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const videosText = videos && videos.length > 0
            ? videos.map((v: any, i: number) => `[Video ${i + 1}] ${v.title} (${v.channel})\nTranscript: ${v.transcript || '(No transcript)'}`).join("\n\n")
            : "No video intelligence available.";

        const prompt = `
            SOURCE 1: NEWS SUMMARY
            ${newsSummary || "No news summary available."}

            SOURCE 1.5: DEEP DIVE FINDINGS
            ${deepAnalysis || "No deep analysis available."}
            
            SOURCE 2: VIDEOS
            ${videosText}
            
            TASK: Write a Deep Dive Intelligence Report on ${topic}.
            Include a section: ## 🔗 SOURCES listing the news links provided.
            
            STRUCTURE:
            # [URGENT/CATCHY TITLE]
            ## 🔍 THE OFFICIAL NARRATIVE (News)
            ## 🕵️‍♂️ DEEP DIVE INSIGHTS (Hidden Details found in full text)
            ## 👁️ ON THE GROUND (Video Evidence)
            ## 📱 SOCIAL PULSE (What's Viral)
            ## 🧠 AGENT'S ANALYSIS (Hidden Truths)
            ## 🔗 SOURCES (List the Verified News Links provided in Source 1)
            
            Keep it markdown formatted.
        `;

        console.log(`[Step 3] Generating main report...`);
        const finalReport = await callLLM({
            task: 'DEEP_ANALYSIS',
            messages: [
                { role: 'system', content: 'You are an investigative journalist writing intelligence reports.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.4
        });

        console.log(`[Step 3] Report generated. Generating content ideas...`);
        const ideasPrompt = `Based on this report:\n${finalReport}\nGenerate 3 viral Instagram Reel ideas that visualize these hidden truths.`;
        const ideas = await callLLM({
            task: 'SUMMARIZE',
            messages: [
                { role: 'system', content: 'You generate viral content ideas for social media.' },
                { role: 'user', content: ideasPrompt }
            ],
            temperature: 0.5
        });

        // Save to Firestore
        const reportData = {
            summary: finalReport,
            ideas: ideas,
            status: 'completed',
            videoCount: videos?.length || 0,
            sources: sources || [],
            videos: videos || [],
            queries: queries || []
        };

        console.log(`[Step 3] Saving to Firestore...`);

        let finalDocId = reportId;
        if (reportId) {
            await db.collection("reports").doc(reportId).update(reportData);
        } else {
            const docRef = await db.collection("reports").add({
                ...reportData,
                topic: topic,
                date: new Date(),
                docUrl: "#",
                type: topic ? "manual" : "weekly",
                isPublic: isPublic || false,
                userId: userId,
                createdAt: new Date(),
            });
            finalDocId = docRef.id;
        }

        console.log(`[Step 3] Report saved. ID: ${finalDocId}`);
        res.json({ id: finalDocId, summary: finalReport });

    } catch (error) {
        console.error("Step 3 Error:", error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorMessage = error instanceof Error ? error.message : (error as any)?.toString() || 'Unknown error';
        res.status(500).json({ error: `Failed to generate report: ${errorMessage}` });
    }
});

// --- ORCHESTRATED WORKFLOW (V3) ---
// WRAPS THE FULL 13-STEP V2 PIPELINE WITH AI EVALUATION
app.post('/v3/orchestrated-workflow', async (req, res) => {
    const { topic, reportId, isPublic, userId } = req.body;

    if (!topic || !reportId) {
        return res.status(400).json({ error: 'Topic and reportId are required' });
    }

    // Import orchestrator
    const { createOrchestrator } = await import('./lib/orchestrator');

    const orchestrator = createOrchestrator({
        reportId,
        topic,
        enableAIDecisions: true,
        verbose: true
    });

    // Helper to call internal endpoints
    const callEndpoint = async (path: string, body: any): Promise<any> => {
        const baseUrl = `http://localhost:${PORT}`;
        const response = await fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${path} failed: ${response.status} - ${errText.substring(0, 2000)}`);
        }
        return response.json();
    };

    // Generic evaluator for most steps
    const genericEvaluator = (data: any) => {
        if (!data) return { quality: 'error' as const, issue: 'No data returned' };
        const keys = Object.keys(data);
        if (keys.length === 0) return { quality: 'empty' as const, issue: 'Empty object' };
        return { quality: 'good' as const, metrics: { keys: keys.length } };
    };

    try {
        await orchestrator.log('workflow', `Starting V2 Pipeline Orchestration for: ${topic}`, 'info');

        // ==========================================
        // PHASE 1: NEWS RESEARCH (Steps 1-5)
        // ==========================================

        // Step 1: Keywords
        const step1 = await orchestrator.runStep({
            name: 'step1_keywords',
            execute: async () => callEndpoint('/v2/step1-keywords', { topic }),
            evaluate: genericEvaluator,
            retryStrategy: 'broader_query',
            canSkip: false
        });
        const keywords = step1.data.keywords;

        // Step 2: Search
        const step2 = await orchestrator.runStep({
            name: 'step2_search',
            execute: async () => callEndpoint('/v2/step2-search', { keywords }),
            evaluate: genericEvaluator,
            retryStrategy: 'broader_query',
            canSkip: false
        });
        const searchResults = step2.data.results;

        // Step 3: Scrape
        const urls = searchResults.slice(0, 5).map((r: any) => r.url);
        const step3 = await orchestrator.runStep({
            name: 'step3_scrape',
            execute: async () => callEndpoint('/v2/step3-scrape', { urls }),
            evaluate: genericEvaluator,
            retryStrategy: 'skip',
            canSkip: true
        });
        const scrapeResults = step3.data?.results || [];

        // Step 4: Structure
        const articlesToStructure = scrapeResults
            .filter((r: any) => r.markdown && r.markdown.length > 500)
            .map((r: any) => ({ markdown: r.markdown, url: r.metadata?.sourceURL || r.url }));

        const step4 = await orchestrator.runStep({
            name: 'step4_structure',
            execute: async () => callEndpoint('/v2/step4-structure', { articles: articlesToStructure }),
            evaluate: genericEvaluator,
            canSkip: true
        });
        const structuredArticles = step4.data?.articles || [];

        // Step 5: Summarize
        const step5 = await orchestrator.runStep({
            name: 'step5_summarize',
            execute: async () => callEndpoint('/v2/step5-summarize', { articles: structuredArticles }),
            evaluate: genericEvaluator,
            canSkip: true
        });
        const summarizedArticles = step5.data?.articles || [];

        // ==========================================
        // PHASE 2: VIDEO INTELLIGENCE (Steps 6-8)
        // ==========================================

        // Step 6: Queries
        const step6 = await orchestrator.runStep({
            name: 'step6_queries',
            execute: async () => callEndpoint('/v2/step6-queries', { topic, articles: summarizedArticles }),
            evaluate: genericEvaluator,
            canSkip: true
        });
        const videoQueries = step6.data?.queries || [topic];

        // Step 7: Videos
        const step7 = await orchestrator.runStep({
            name: 'step7_videos',
            execute: async () => callEndpoint('/v2/step7-videos', { queries: videoQueries }),
            evaluate: genericEvaluator,
            retryStrategy: 'broader_query',
            canSkip: true
        });
        const videos = step7.data?.videos || [];

        // Step 8: Transcribe
        // We only transcribe top 3 to save time/cost
        const step8 = await orchestrator.runStep({
            name: 'step8_transcribe',
            execute: async () => callEndpoint('/v2/step8-transcribe', { videos: videos.slice(0, 3) }),
            evaluate: genericEvaluator,
            canSkip: true
        });
        const transcribedVideos = step8.data?.videos || videos.slice(0, 3);

        // ==========================================
        // PHASE 3: ANALYSIS & MERGE (Steps 9-10)
        // ==========================================

        // Step 9: Verify & Classify (Parallel-ish) via Merge
        // detailed steps 9-verify and 9-classify skipped for speed, going straight to merge which is stronger

        // Step 9: Merge
        const step9 = await orchestrator.runStep({
            name: 'step9_merge',
            evaluate: genericEvaluator,
            execute: async () => callEndpoint('/v2/step9-merge', {
                topic,
                articles: summarizedArticles,
                videos: transcribedVideos,
                enrich: true
            }),
            canSkip: false // Critical step
        });
        const mergedSources = step9.data.sources;

        // Step 10: Normalize
        const step10 = await orchestrator.runStep({
            name: 'step10_normalize',
            evaluate: genericEvaluator,
            execute: async () => callEndpoint('/v2/step10-normalize', {
                topic,
                articles: [], // iterate if needed, but merge usually handles it
                videos: []
                // Note: The normalize endpoint might expect raw arrays if merge didn't happen, 
                // but since we merged, we might want to skip or pass merged. 
                // Let's assume merge output is sufficient for analysis.
                // Actually, let's skip explicit normalize endpoint if merge provided clean sources.
            }),
            canSkip: true
        });
        // We'll use mergedSources as the source of truth for analysis

        // ==========================================
        // PHASE 4: FINAL REPORT (Steps 11-13)
        // ==========================================

        // Step 11: Deep Analysis
        const step11 = await orchestrator.runStep({
            name: 'step11_analyze',
            evaluate: genericEvaluator,
            execute: async () => callEndpoint('/v2/step11-analyze', { topic, sources: mergedSources }),
            canSkip: false
        });
        const analysis = step11.data;

        // Step 12: Content Ideas
        const step12 = await orchestrator.runStep({
            name: 'step12_content',
            evaluate: genericEvaluator,
            execute: async () => callEndpoint('/v2/step12-content', { analysis }),
            canSkip: true
        });
        const contentIdeas = step12.data;

        // Step 13: Final Report
        const step13 = await orchestrator.runStep({
            name: 'step13_report',
            evaluate: (data: any) => {
                if (!data?.report_id && !data?.id) return { quality: 'error' as const, issue: 'No report ID returned' };
                return { quality: 'good' as const, metrics: { reportId: data.report_id } };
            },
            execute: async () => callEndpoint('/v2/step13-report', {
                topic,
                sources: mergedSources,
                deep_analysis: analysis,
                content_ideas: contentIdeas,
                executive_summary: analysis.executive_summary
            }),
            canSkip: false
        });

        await orchestrator.log('workflow', 'V2 Pipeline Completed Successfully', 'success');
        await orchestrator.finalize(true);

        // Update Firestore report status to 'completed'
        await db.collection('reports').doc(reportId).update({ status: 'completed' });

        console.log(`[V3 Orchestrator] ✅ Sending success response for reportId: ${reportId}`);
        res.json({ success: true, reportId, logs: orchestrator.getHistory() });

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await orchestrator.log('workflow', `Pipeline Failed: ${errorMsg}`, 'error');
        await orchestrator.finalize(false);

        // Update Firestore report status to 'failed'
        try {
            await db.collection('reports').doc(reportId).update({ status: 'failed', error: errorMsg });
        } catch (e) {
            console.error('[V3 Orchestrator] Failed to update report status:', e);
        }

        res.status(500).json({ success: false, error: errorMsg, logs: orchestrator.getHistory() });
    }
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
