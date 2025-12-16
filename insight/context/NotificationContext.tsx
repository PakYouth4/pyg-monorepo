"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

export interface ScanNotification {
    id: string; // The ID of the notification itself (or scan ID)
    topic: string;
    status: string;
    progress: number;
    reportId?: string; // The ID of the generated report
    isComplete: boolean;
    error?: string;
    timestamp: number;
}

interface NotificationContextType {
    notifications: ScanNotification[];
    startScan: (topic: string, config: any) => Promise<void>;
    dismissNotification: (id: string) => void;
    unreadCount: number;
    markAllAsRead: () => void;
    isScanning: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<ScanNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load from LocalStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('research_notifications');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setNotifications(parsed);

                // Re-attach listeners and resume simulation for any incomplete scans
                parsed.forEach((n: ScanNotification) => {
                    if (!n.isComplete) {
                        if (n.reportId) monitorScanProgress(n.id, n.reportId);
                        simulateProgress(n.id); // Resume visual progress
                    }
                });
            } catch (e) {
                console.error("Failed to parse notifications", e);
            }
        }
        setIsInitialized(true);
    }, []);

    // Save to LocalStorage on change (Only after initialization)
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem('research_notifications', JSON.stringify(notifications));
            setUnreadCount(notifications.filter(n => !n.isComplete || (n.isComplete && !n.id.includes('read'))).length); // Simplified unread logic
        }
    }, [notifications, isInitialized]);

    const simulateProgress = (scanId: string) => {
        const interval = setInterval(() => {
            setNotifications(prev => {
                const notif = prev.find(n => n.id === scanId);

                // Self-cleanup if complete or removed
                if (!notif || notif.isComplete) {
                    clearInterval(interval);
                    return prev;
                }

                let newProgress = notif.progress + 5; // Slower progress to avoid hitting 100 too fast
                if (newProgress >= 90) newProgress = 90;

                let newStatus = notif.status;
                if (newProgress === 10) newStatus = 'Scanning Global Intelligence Feeds...';
                if (newProgress === 30) newStatus = 'Analyzing & Summarizing Reports...';
                if (newProgress === 60) newStatus = 'Generating Strategic Content Ideas...';
                if (newProgress === 80) newStatus = 'Compiling Final Document...';

                return prev.map(n => n.id === scanId ? { ...n, progress: newProgress, status: newStatus } : n);
            });
        }, 3000);
        return interval;
    };

    const monitorScanProgress = (scanId: string, reportId: string) => {
        // Listen to the specific report document
        const unsub = onSnapshot(doc(db, "reports", reportId), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                if (data.status === 'completed') {
                    updateNotification(scanId, {
                        progress: 100,
                        status: 'Research Complete',
                        isComplete: true,
                        reportId: reportId
                    });
                    unsub(); // Stop listening
                } else if (data.status === 'failed') {
                    updateNotification(scanId, {
                        status: 'Research Failed',
                        error: 'Server reported failure',
                        isComplete: true,
                        progress: 100
                    });
                    unsub();
                }
            }
        });
    };

    const startScan = async (topic: string, config: any) => {
        const scanId = Date.now().toString();
        console.log(`[Scan] Starting scan for topic: "${topic}"`, config);

        // 1. Add initial notification
        const newNotification: ScanNotification = {
            id: scanId,
            topic,
            status: 'Initializing...',
            progress: 10, // Start at 10% to give immediate feedback
            isComplete: false,
            timestamp: Date.now()
        };

        setNotifications(prev => [newNotification, ...prev]);

        // 2. Create Placeholder Report
        let reportId = '';
        try {
            console.log("[Scan] Creating placeholder report in Firestore...");
            const docRef = await addDoc(collection(db, "reports"), {
                date: Timestamp.now(),
                topic: topic || "General",
                type: "manual",
                status: "generating",
                createdAt: Timestamp.now(),
                isPublic: config.isPublic,
                userId: config.userId
            });
            reportId = docRef.id;
            console.log(`[Scan] Placeholder created. ID: ${reportId}`);

            // Update notification with reportId so we can track it
            updateNotification(scanId, { reportId });

        } catch (e) {
            console.error("[Scan] Failed to create placeholder:", e);
            updateNotification(scanId, { status: 'Failed to initialize', error: 'Connection error', isComplete: true });
            return;
        }

        // 3. Start Simulation & Fetch (Background Process)
        runBackgroundScan(scanId, reportId, topic, config);

        // 4. Attach Firestore Listener (Backup for refresh/disconnect)
        monitorScanProgress(scanId, reportId);
    };

    const runBackgroundScan = async (scanId: string, reportId: string, topic: string, config: any) => {
        const update = (data: Partial<ScanNotification>) => updateNotification(scanId, data);

        // Helper to save logs to Firestore
        const logToFirestore = async (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
            try {
                // We use arrayUnion to append to the 'logs' field
                // Note: We need to import arrayUnion from firebase/firestore
                const { arrayUnion, updateDoc, doc } = await import('firebase/firestore');
                const logEntry = {
                    timestamp: Date.now(),
                    message,
                    type
                };
                await updateDoc(doc(db, "reports", reportId), {
                    logs: arrayUnion(logEntry)
                });
            } catch (e) {
                console.error("Failed to save log to Firestore:", e);
            }
        };

        // Start Simulation
        const interval = simulateProgress(scanId);

        try {
            console.log(`[Scan] Starting Daisy Chain Process...`);
            await logToFirestore(`Starting Research Scan for: ${topic}`, 'info');

            // --- STEP 1: NEWS ---
            update({ status: 'Reading Global News... 🌍', progress: 20 });
            console.log("[Scan] Step 1: Fetching News...");
            await logToFirestore("Step 1: Fetching News from RSS Feeds...", 'info');

            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:7860';

            const res1 = await fetch(`${backendUrl}/step1-news`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });

            if (!res1.ok) {
                const errText = await res1.text();
                await logToFirestore(`Step 1 Failed: ${res1.statusText}`, 'error');
                throw new Error(`Step 1 (News) Failed: ${res1.status} ${res1.statusText} - ${errText.substring(0, 100)}`);
            }

            const data1 = await res1.json();
            console.log("[Scan] Step 1 Complete:", data1);
            await logToFirestore(`Step 1 Complete. Found ${data1.sources.length} sources.`, 'success');

            // --- STEP 1.5: DEEP RESEARCH (Scraping) ---
            update({ status: 'Reading Full Articles (Deep Dive)... 📖', progress: 35 });
            console.log("[Scan] Step 1.5: Deep Research...");
            await logToFirestore("Step 1.5: Deep Research (Scraping top articles)...", 'info');

            let deepAnalysis = "";
            try {
                const resDeep = await fetch(`${backendUrl}/step1-5-deep`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        newsSummary: data1.newsSummary,
                        sources: data1.sources
                    })
                });
                if (resDeep.ok) {
                    const dataDeep = await resDeep.json();
                    deepAnalysis = dataDeep.deepAnalysis;
                    console.log("[Scan] Step 1.5 Complete:", deepAnalysis.substring(0, 50) + "...");
                    await logToFirestore("Step 1.5 Complete: Deep Analysis generated.", 'success');
                } else {
                    const errText = await resDeep.text();
                    console.warn("[Scan] Step 1.5 Failed (Non-fatal):", errText);
                    await logToFirestore(`Step 1.5 Warning: Scraper failed (${errText.substring(0, 50)}...). Proceeding with summary only.`, 'warning');
                }
            } catch (e) {
                console.warn("[Scan] Step 1.5 Error (Non-fatal):", e);
                await logToFirestore(`Step 1.5 Error: ${e}`, 'warning');
            }

            // --- STEP 2: VIDEOS ---
            update({ status: 'Watching Videos... 👁️ (This may take 30s)', progress: 50 });
            console.log("[Scan] Step 2: Analyzing Videos...");
            await logToFirestore("Step 2: Searching & Filtering Videos...", 'info');

            const res2 = await fetch(`${backendUrl}/step2-videos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newsSummary: data1.newsSummary + "\n\n" + deepAnalysis }) // Pass deep context to video search
            });

            if (!res2.ok) {
                const errText = await res2.text();
                await logToFirestore(`Step 2 Failed: ${errText}`, 'error');
                throw new Error(`Step 2 (Videos) Failed: ${res2.status} - ${errText.substring(0, 100)}`);
            }

            const data2 = await res2.json();
            const candidates = data2.candidates || [];
            console.log("[Scan] Step 2 Complete (Candidates Found):", candidates.length);

            if (candidates.length === 0) {
                await logToFirestore("Step 2 Warning: No relevant videos found after AI filtering.", 'warning');
            } else {
                await logToFirestore(`Step 2 Complete. Found ${candidates.length} relevant videos.`, 'success');
            }

            // --- STEP 2.5: DAISY-CHAIN TRANSCRIPTS ---
            // Loop through each video and fetch transcript individually to avoid timeout
            const finalVideos = [];

            for (let i = 0; i < candidates.length; i++) {
                const video = candidates[i];
                update({
                    status: `Analyzing Video ${i + 1}/${candidates.length}: ${video.title.substring(0, 20)}... 👁️`,
                    progress: 50 + Math.floor((i / candidates.length) * 30) // Progress from 50% to 80%
                });

                try {
                    await logToFirestore(`Step 2.5: Fetching transcript for video ${i + 1}/${candidates.length} (${video.title})...`, 'info');
                    const resTranscript = await fetch(`${backendUrl}/step2-5-transcript`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            videoId: video.id,
                            videoTitle: video.title,
                            videoChannel: video.channel,
                            videoDescription: video.description,
                            foundByKeyword: video.foundByKeyword
                        })
                    });

                    if (resTranscript.ok) {
                        const dataTranscript = await resTranscript.json();
                        finalVideos.push(dataTranscript.video);
                        await logToFirestore(`Step 2.5: Transcript fetched for video ${video.id}.`, 'success');
                    } else {
                        console.warn(`[Scan] Failed to process video ${video.id}`);
                        await logToFirestore(`Step 2.5 Warning: Failed to fetch transcript for ${video.id}.`, 'warning');
                    }
                } catch (err) {
                    console.error(`[Scan] Error processing video ${video.id}`, err);
                    await logToFirestore(`Step 2.5 Error: ${err}`, 'error');
                }
            }

            console.log("[Scan] Step 2.5 Complete. Processed Videos:", finalVideos.length);
            await logToFirestore(`Step 2.5 Complete. Successfully processed ${finalVideos.length} videos.`, 'success');

            // --- STEP 3: GENERATE REPORT ---
            update({ status: 'Connecting the Dots... 🧠', progress: 85 });
            console.log("[Scan] Step 3: Writing Report...");
            await logToFirestore("Step 3: Generating Final Intelligence Report...", 'info');

            const res3 = await fetch(`${backendUrl}/step3-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic,
                    newsSummary: data1.newsSummary,
                    deepAnalysis: deepAnalysis, // Pass the deep analysis
                    sources: data1.sources,
                    videos: finalVideos, // Pass the daisy-chained videos
                    queries: data2.queries,
                    reportId,
                    isPublic: config.isPublic,
                    userId: config.userId
                })
            });

            if (!res3.ok) {
                const errText = await res3.text();
                await logToFirestore(`Step 3 Failed: ${errText}`, 'error');
                throw new Error(`Step 3 (Report) Failed: ${res3.status} - ${errText.substring(0, 100)}`);
            }
            const data3 = await res3.json();
            console.log("[Scan] Step 3 Complete:", data3);
            await logToFirestore("Step 3 Complete. Report generated successfully.", 'success');

            clearInterval(interval);

            console.log("[Scan] Research completed successfully!");
            update({
                progress: 100,
                status: 'Research Complete',
                isComplete: true,
                reportId: reportId
            });

        } catch (error) {
            clearInterval(interval);
            console.error("[Scan] Fatal Error Object:", error);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errorMessage = error instanceof Error ? error.message : (error as any)?.toString() || 'Unknown error';
            console.error("[Scan] Fatal Error Message:", errorMessage);

            await logToFirestore(`FATAL ERROR: ${errorMessage}`, 'error');

            update({
                status: 'Research Failed',
                error: errorMessage,
                isComplete: true,
                progress: 100
            });
        }
    };

    const updateNotification = (id: string, data: Partial<ScanNotification>) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
    };

    const dismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const markAllAsRead = () => {
        // We don't really have a "read" property, just clearing unread count visually
        // In a real app we'd map notifications to have read: true
    };

    const isScanning = notifications.some(n => !n.isComplete);

    return (
        <NotificationContext.Provider value={{ notifications, startScan, dismissNotification, unreadCount, markAllAsRead, isScanning }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}
