"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, ExternalLink, FileText, Youtube, Search, Database } from 'lucide-react';

interface LogEntry {
    timestamp: number;
    message: string;
    type: 'info' | 'error' | 'success' | 'warning';
}

interface LogVideo {
    id: string;
    title: string;
    channel: string;
    description: string;
    foundByKeyword: string;
    transcript: string;
}

interface LogReport {
    id: string;
    topic: string;
    date: string;
    queries?: string[];
    videos?: LogVideo[];
    sources?: string[];
    logs?: LogEntry[]; // New logs field
    userId: string;
    isPublic: boolean;
}

export default function LogsPage({ params }: { params: { id: string } }) {
    const [report, setReport] = useState<LogReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const { user, loading: authLoading } = useAuth();
    const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const fetchReport = async () => {
            if (authLoading) return;

            try {
                const docRef = doc(db, "reports", params.id);

                // Realtime Listener
                unsubscribe = onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const isPublic = data.isPublic || false;
                        const ownerId = data.userId;

                        if (!isPublic && (!user || user.uid !== ownerId)) {
                            setAccessDenied(true);
                            setLoading(false);
                            return;
                        }

                        // Safe Date Parsing
                        let dateStr = new Date().toISOString();
                        if (data.date) {
                            if (typeof data.date.toDate === 'function') {
                                dateStr = data.date.toDate().toISOString();
                            } else if (typeof data.date === 'string') {
                                dateStr = data.date;
                            }
                        }

                        setReport({
                            id: docSnap.id,
                            topic: data.topic || 'General Weekly',
                            date: dateStr,
                            queries: data.queries || [],
                            videos: data.videos || [],
                            sources: data.sources || [],
                            logs: data.logs || [], // Fetch logs
                            userId: ownerId,
                            isPublic: isPublic
                        });
                        setLoading(false);
                    } else {
                        setLoading(false);
                    }
                }, (error) => {
                    console.error("Error listening to logs:", error);
                    setLoading(false);
                });

            } catch (error) {
                console.error("Error setting up listener:", error);
                setLoading(false);
            }
        };

        fetchReport();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [params.id, user, authLoading]);

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono animate-pulse">
                Loading Research Logs...
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
                <h1 className="text-2xl font-bold mb-2 text-red-500">Access Denied</h1>
                <Link href="/dashboard" className="text-gray-400 hover:text-white">Return to Dashboard</Link>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
                <h1 className="text-2xl font-bold mb-2">Logs Not Found</h1>
                <Link href="/dashboard" className="text-gray-400 hover:text-white">Return to Dashboard</Link>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white p-6 md:p-12 max-w-6xl mx-auto font-sans">
            {/* Header */}
            <div className="mb-8 border-b border-gray-800 pb-6">
                <Link href={`/report/${params.id}`} className="flex items-center text-gray-500 hover:text-white mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Report
                </Link>
                <div className="flex items-center gap-3 mb-2">
                    <Database className="w-6 h-6 text-primary" />
                    <h1 className="text-3xl font-bold">Research Logs</h1>
                </div>
                <p className="text-gray-400 font-mono text-sm">
                    Raw intelligence data for: <span className="text-white">{report.topic}</span>
                </p>
            </div>

            {/* Execution Timeline (New) */}
            <div className="mb-8">
                <section className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4 text-primary">
                        <FileText className="w-5 h-5" />
                        <h2 className="font-bold uppercase tracking-wider text-sm">Agent Execution Timeline</h2>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
                        {report.logs && report.logs.length > 0 ? (
                            report.logs.map((log, i) => (
                                <div key={i} className={`flex gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'warning' ? 'text-yellow-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
                                    <span className="opacity-50 min-w-[80px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    <span>{log.message}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 italic">No execution logs available for this report.</p>
                        )}
                    </div>
                </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Queries & Sources */}
                <div className="space-y-8">
                    {/* Search Queries */}
                    <section className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-2 mb-4 text-primary">
                            <Search className="w-5 h-5" />
                            <h2 className="font-bold uppercase tracking-wider text-sm">Search Queries</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {report.queries && report.queries.length > 0 ? (
                                report.queries.map((q, i) => (
                                    <span key={i} className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-xs font-mono border border-gray-700">
                                        {q}
                                    </span>
                                ))
                            ) : (
                                <p className="text-gray-500 text-xs italic">No query data available.</p>
                            )}
                        </div>
                    </section>

                    {/* News Sources */}
                    <section className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-2 mb-4 text-primary">
                            <ExternalLink className="w-5 h-5" />
                            <h2 className="font-bold uppercase tracking-wider text-sm">News Sources</h2>
                        </div>
                        <ul className="space-y-3">
                            {report.sources && report.sources.length > 0 ? (
                                report.sources.map((source, i) => (
                                    <li key={i}>
                                        <a href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-white break-all flex items-start gap-2 group">
                                            <span className="text-gray-600 group-hover:text-primary mt-0.5">●</span>
                                            {source}
                                        </a>
                                    </li>
                                ))
                            ) : (
                                <p className="text-gray-500 text-xs italic">No source data available.</p>
                            )}
                        </ul>
                    </section>
                </div>

                {/* Right Column: Videos & Transcripts */}
                <div className="lg:col-span-2">
                    <section className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-2 mb-6 text-primary">
                            <Youtube className="w-5 h-5" />
                            <h2 className="font-bold uppercase tracking-wider text-sm">Video Intelligence ({report.videos?.length || 0})</h2>
                        </div>

                        <div className="space-y-4">
                            {report.videos && report.videos.length > 0 ? (
                                report.videos.map((video) => (
                                    <div key={video.id} className="border border-gray-800 rounded-lg overflow-hidden bg-black/50">
                                        <div
                                            className="p-4 flex items-start justify-between cursor-pointer hover:bg-gray-900/50 transition-colors"
                                            onClick={() => setExpandedVideo(expandedVideo === video.id ? null : video.id)}
                                        >
                                            <div className="flex-1 min-w-0 mr-4">
                                                <h3 className="font-bold text-sm text-white truncate">{video.title}</h3>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-mono">
                                                    <span>{video.channel}</span>
                                                    <span className="text-gray-700">|</span>
                                                    <span className="text-green-500/80">Found by: &quot;{video.foundByKeyword}&quot;</span>
                                                </div>
                                            </div>
                                            <button className="text-xs font-bold text-primary uppercase tracking-wider">
                                                {expandedVideo === video.id ? 'Hide' : 'View'} Transcript
                                            </button>
                                        </div>

                                        {expandedVideo === video.id && (
                                            <div className="p-4 border-t border-gray-800 bg-gray-900/30">
                                                <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 uppercase tracking-widest">
                                                    <FileText className="w-3 h-3" />
                                                    <span>Transcript Data</span>
                                                </div>
                                                <div className="max-h-96 overflow-y-auto p-3 bg-black rounded border border-gray-800 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
                                                    {video.transcript || "No transcript available."}
                                                </div>
                                                <div className="mt-3 text-right">
                                                    <a
                                                        href={`https://www.youtube.com/watch?v=${video.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline"
                                                    >
                                                        Watch on YouTube ↗
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-gray-500 italic">
                                    No video intelligence data found.
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
