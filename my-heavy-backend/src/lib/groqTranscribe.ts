import { YoutubeTranscript } from 'youtube-transcript';
import { VideoResult } from './youtubeSearch';

export interface TranscribedVideo extends VideoResult {
    transcript: string;
    transcript_source: "captions" | "unavailable";
}

/**
 * Process a video by fetching its captions.
 * If captions are unavailable, return "Transcript unavailable."
 */
export async function processVideoWithGroq(video: VideoResult): Promise<TranscribedVideo> {

    try {
        const transcriptItems = await YoutubeTranscript.fetchTranscript(video.url);
        const text = transcriptItems.map((t) => t.text).join(' ');

        if (text && text.length > 50) {
            return { ...video, transcript: text, transcript_source: "captions" };
        } else {
            // Empty captions
            return { ...video, transcript: "Transcript unavailable.", transcript_source: "unavailable" };
        }
    } catch (e) {
        console.warn(`Captions failed for ${video.id}:`, e);
        return {
            ...video,
            transcript: "Transcript unavailable.",
            transcript_source: "unavailable"
        };
    }
}

export async function processVideosInParallel(videos: VideoResult[]): Promise<TranscribedVideo[]> {
    console.log(`Processing captions for ${videos.length} videos...`);

    // Process all in parallel (captions are fast)
    const promises = videos.map((v) => processVideoWithGroq(v));
    const results = await Promise.all(promises);
    return results;
}
