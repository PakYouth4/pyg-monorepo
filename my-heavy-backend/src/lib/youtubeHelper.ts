import { YoutubeTranscript } from 'youtube-transcript';
// NOTE: Audio download imports kept for future server deployment
// import ytdl from '@distube/ytdl-core';
// import { GoogleAIFileManager } from "@google/generative-ai/server";
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import fs from 'fs';
// import path from 'path';
// import os from 'os';

/**
 * Get transcript for a YouTube video (captions-only mode)
 * Audio download is disabled for serverless (HuggingFace) compatibility
 * 
 * @returns transcript text or "(Transcript unavailable)" if no captions exist
 */
export async function getSmartTranscript(videoId: string): Promise<string> {
    try {
        // PLAN A: Fetch YouTube captions (works ~70% of videos)
        console.log(`[Transcript] Fetching captions for video: ${videoId}`);
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        const transcript = transcriptItems.map(t => t.text).join(" ");
        console.log(`[Transcript] Success! Got ${transcript.length} chars for ${videoId}`);
        return transcript;
    } catch (error) {
        // Captions not available - no fallback on serverless
        console.log(`[Transcript] No captions available for ${videoId}. Serverless mode - skipping audio download.`);
        return "(Transcript unavailable - no captions)";
    }
}

/*
 * PLAN B: Audio Download + Whisper (DISABLED for serverless)
 * This code is preserved for future use when running on a dedicated server.
 * 
 * To re-enable:
 * 1. Uncomment the imports at top of file
 * 2. Uncomment this function
 * 3. Update getSmartTranscript's catch block to call this
 *
async function downloadAndTranscribeWithGemini(videoId: string): Promise<string> {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const tempFilePath = path.join(os.tmpdir(), `${videoId}.m4a`);

    try {
        // 1. Download Low-Quality Audio
        const stream = ytdl(videoUrl, {
            quality: 'lowestaudio',
            filter: f => f.container === 'mp4' && f.hasAudio && !f.hasVideo
        });

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(tempFilePath);
            stream.pipe(writer);
            writer.on('finish', () => resolve(undefined));
            writer.on('error', reject);
        });

        // 2. Upload to Gemini
        const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);
        const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: "audio/mp4",
            displayName: videoId,
        });

        // 3. Listen & Transcribe
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([
            "Generate a verbatim transcript of the spoken content in this audio.",
            { fileData: { fileUri: uploadResult.file.uri, mimeType: uploadResult.file.mimeType } },
        ]);

        // 4. Cleanup
        await fileManager.deleteFile(uploadResult.file.name);
        fs.unlinkSync(tempFilePath);
        return result.response.text();

    } catch (e) {
        console.error("Plan B Failed:", e);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return "(Transcript unavailable)";
    }
}
*/

