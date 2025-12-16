"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Report } from '@/hooks/useReports';
import { useAuth } from '@/hooks/useAuth'; // Import Auth

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ReportPage({ params }: { params: { id: string } }) {
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const { user, loading: authLoading } = useAuth();

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchReport = async () => {
            // Wait for auth to initialize so we can check ownership
            if (authLoading) return;

            try {
                const docRef = doc(db, "reports", params.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const isPublic = data.isPublic || false;
                    const ownerId = data.userId;

                    // VISIBILITY CHECK
                    // If private AND (no user OR user is not owner) -> Access Denied
                    if (!isPublic && (!user || user.uid !== ownerId)) {
                        setAccessDenied(true);
                        setLoading(false);
                        return;
                    }

                    setReport({
                        id: docSnap.id,
                        topic: data.topic || 'General Weekly',
                        date: data.date?.toDate ? data.date.toDate().toISOString() : new Date().toISOString(),
                        summary: data.summary || '',
                        ideas: data.ideas || '',
                        docUrl: data.docUrl || '#',
                        type: data.type || 'weekly',
                        isPublic: isPublic,
                        userId: ownerId
                    });
                } else {
                    // Document does not exist
                    console.log("Document does not exist");
                }
            } catch (error: unknown) {
                console.error("Error fetching report:", error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [params.id, user, authLoading]);

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono animate-pulse">
                Loading Report Data...
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold mb-2">Private Report</h1>
                <p className="text-gray-400 mb-8 max-w-md">
                    This intelligence report is marked as private and can only be viewed by its owner.
                </p>
                <Link href="/dashboard" className="px-6 py-3 bg-white text-black font-bold uppercase tracking-widest text-sm hover:bg-gray-200 transition-colors">
                    Return to Dashboard
                </Link>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Report Not Found</h1>
                <p className="text-gray-500 mb-4">The report you are looking for does not exist or has been deleted.</p>
                {error && (
                    <div className="bg-red-900/20 border border-red-500/30 p-4 rounded mb-8 max-w-md">
                        <p className="text-red-400 font-mono text-xs break-all">Error: {error}</p>
                    </div>
                )}
                <Link href="/dashboard" className="text-primary hover:underline uppercase tracking-widest text-sm font-bold">
                    ← Return to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white p-8 md:p-12 max-w-4xl mx-auto font-sans">
            {/* Navigation */}
            <div className="mb-12">
                <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm uppercase tracking-widest transition-colors">
                    ← Back to Dashboard
                </Link>
            </div>

            {/* Header */}
            <header className="mb-12 border-b border-gray-800 pb-8">
                <div className="flex items-center gap-4 mb-4">
                    <span className="text-primary font-mono text-sm">{new Date(report.date).toLocaleDateString()}</span>
                    {report.type === 'weekly' ? (
                        <span className="text-xs font-bold uppercase px-2 py-0.5 bg-red-900/30 text-red-400 border border-red-900/50 rounded">
                            AUTOMATIC
                        </span>
                    ) : (
                        <span className="text-xs font-bold uppercase px-2 py-0.5 bg-green-900/30 text-green-400 border border-green-900/50 rounded">
                            MANUAL
                        </span>
                    )}
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                    {report.topic === 'General' || report.topic === 'General Weekly' ? 'Weekly Research Digest' : report.topic}
                </h1>
                <p className="text-gray-400 text-lg">
                    {report.type === 'weekly'
                        ? 'Automated intelligence report generated for Pak Youth For Gaza.'
                        : 'Manual intelligence briefing generated by agent.'}
                </p>
            </header>

            {/* Content Sections */}
            <div className="space-y-12">
                {/* Section 1: Summary */}
                <section>
                    <h2 className="text-xl font-bold text-primary mb-6 uppercase tracking-wider">
                        01 // Executive Summary
                    </h2>
                    <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                table: ({ ...props }) => <div className="overflow-x-auto my-8"><table className="min-w-full border border-gray-800 text-sm" {...props} /></div>,
                                th: ({ ...props }) => <th className="border border-gray-800 bg-gray-900 px-4 py-2 text-left font-bold text-white" {...props} />,
                                td: ({ ...props }) => <td className="border border-gray-800 px-4 py-2" {...props} />,
                                h1: ({ ...props }) => <h1 className="text-2xl font-bold text-white mt-8 mb-4" {...props} />,
                                h2: ({ ...props }) => <h2 className="text-xl font-bold text-white mt-8 mb-4 border-b border-gray-800 pb-2" {...props} />,
                                h3: ({ ...props }) => <h3 className="text-lg font-bold text-primary mt-6 mb-3" {...props} />,
                                strong: ({ ...props }) => <strong className="font-bold text-white" {...props} />,
                                ul: ({ ...props }) => <ul className="list-disc list-inside space-y-2 my-4" {...props} />,
                                ol: ({ ...props }) => <ol className="list-decimal list-inside space-y-2 my-4" {...props} />,
                                blockquote: ({ ...props }) => <blockquote className="border-l-4 border-primary pl-4 italic text-gray-400 my-4" {...props} />,
                            }}
                        >
                            {report.summary}
                        </ReactMarkdown>
                    </div>
                </section>

                {/* Section 2: Ideas */}
                <section>
                    <h2 className="text-xl font-bold text-primary mb-6 uppercase tracking-wider">
                        02 // Content Strategy
                    </h2>
                    <div className="bg-gray-900 border-l-2 border-primary p-6 rounded-r-sm">
                        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    table: ({ ...props }) => <div className="overflow-x-auto my-8"><table className="min-w-full border border-gray-700 text-sm" {...props} /></div>,
                                    th: ({ ...props }) => <th className="border border-gray-700 bg-black px-4 py-2 text-left font-bold text-white" {...props} />,
                                    td: ({ ...props }) => <td className="border border-gray-700 px-4 py-2" {...props} />,
                                    h3: ({ ...props }) => <h3 className="text-lg font-bold text-primary mt-6 mb-3" {...props} />,
                                }}
                            >
                                {report.ideas}
                            </ReactMarkdown>
                        </div>
                    </div>
                </section>

                {/* Section 3: Source */}
                <section className="pt-8 border-t border-gray-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-gray-500 text-sm">
                                Source Document:
                            </span>
                            <a
                                href={report.docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-outline text-sm"
                            >
                                Open Google Doc ↗
                            </a>
                        </div>

                        <Link
                            href={`/report/${report.id}/logs`}
                            className="text-sm text-gray-500 hover:text-primary transition-colors flex items-center gap-2"
                        >
                            <span>View Research Logs</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}
