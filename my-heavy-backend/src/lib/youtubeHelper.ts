import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core';
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import os from 'os';

// Config
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function getSmartTranscript(videoId: string): Promise<string> {
    try {
        // PLAN A: Fast Text (95% success)
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        return transcriptItems.map(t => t.text).join(" ");
    } catch (error) {
        console.log(`Plan A failed for ${videoId}. Engaging Gemini Ears...`, error);
        return await downloadAndTranscribeWithGemini(videoId);
    }
}

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
        const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: "audio/mp4",
            displayName: videoId,
        });

        // 3. Listen & Transcribe
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
