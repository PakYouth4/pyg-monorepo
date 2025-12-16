import { NextResponse } from 'next/server';
import { getSmartTranscript } from '@/app/lib/youtubeHelper';

export const maxDuration = 60; // 60s limit per video (plenty of time)
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { videoId, videoTitle, videoChannel, videoDescription, foundByKeyword } = await req.json();

        if (!videoId) {
            return NextResponse.json({ error: "videoId is required" }, { status: 400 });
        }

        // Fetch transcript for this SINGLE video
        let transcript = "";
        try {
            transcript = await getSmartTranscript(videoId);
        } catch (error) {
            console.warn(`Failed to get transcript for ${videoId}:`, error);
            // Fallback: Use description as "transcript" so we at least have some context
            transcript = `(Transcript unavailable. Using Description): ${videoDescription}`;
        }

        return NextResponse.json({
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
        return NextResponse.json({ error: (error as any).message }, { status: 500 });
    }
}
