import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

export interface VideoResult {
    id: string;
    url: string;
    title: string;
    description: string;
    channel: string;
    views: string; // approximate if strict detail needed
    publishedAt: string;
    thumbnail: string;
}

function getYouTubeClient() {
    const key = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
        throw new Error("YOUTUBE_API_KEY (or GOOGLE_API_KEY) is missing.");
    }
    return google.youtube({
        version: 'v3',
        auth: key
    });
}

export async function searchYouTubeV2(queries: string[]): Promise<VideoResult[]> {
    const youtube = getYouTubeClient();
    const allVideos: VideoResult[] = [];
    const seenIds = new Set<string>();

    console.log(`Processing ${queries.length} YouTube queries...`);

    // Limit to first 5 queries to save quota? Or process all?
    // Let's do top 5 queries to be safe on quota, user can request more if needed.
    const activeQueries = queries.slice(0, 5);

    const promises = activeQueries.map(async (q) => {
        try {
            const response = await youtube.search.list({
                part: ['snippet'],
                q: q,
                type: ['video'],
                maxResults: 3, // Top 3 per query = 15 videos max
                relevanceLanguage: 'en',
                order: 'relevance' // or viewCount
            });

            const items = response.data.items || [];
            const results: VideoResult[] = [];

            for (const item of items) {
                const videoId = item.id?.videoId;
                if (!videoId || seenIds.has(videoId)) continue;

                seenIds.add(videoId);

                results.push({
                    id: videoId,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    title: item.snippet?.title || "No Title",
                    description: item.snippet?.description || "",
                    channel: item.snippet?.channelTitle || "Unknown Channel",
                    views: "0", // Search endpoint doesn't return statistics, need extra call if crucial
                    publishedAt: item.snippet?.publishedAt || "",
                    thumbnail: item.snippet?.thumbnails?.high?.url || ""
                });
            }
            return results;
        } catch (e) {
            console.error(`YouTube search failed for query "${q}":`, e);
            return [];
        }
    });

    const results = await Promise.all(promises);
    results.forEach(r => allVideos.push(...r));

    // Optional: Fetch stats (views) for these videos to fill the "views" field
    if (allVideos.length > 0) {
        try {
            const ids = allVideos.map(v => v.id).join(',');
            const statsResponse = await youtube.videos.list({
                part: ['statistics'],
                id: ids.split(',') // batch IDs
            });

            const statsMap = new Map<string, string>();
            statsResponse.data.items?.forEach(item => {
                if (item.id && item.statistics?.viewCount) {
                    statsMap.set(item.id, item.statistics.viewCount);
                }
            });

            // Update views
            allVideos.forEach(v => {
                const views = statsMap.get(v.id);
                if (views) v.views = views;
            });

        } catch (e) {
            console.error("Failed to fetch video stats:", e);
        }
    }

    return allVideos;
}
