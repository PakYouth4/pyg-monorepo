'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { X, Check, AlertTriangle, Info, Bot, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============ TYPES ============

interface OrchestratorLog {
    timestamp: number;
    step: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'ai_decision';
    data?: {
        decision?: string;
        quality?: string;
        retryCount?: number;
        maxRetries?: number;
        modifiedInput?: Record<string, unknown>;
        metrics?: Record<string, unknown>;
    };
}

interface OrchestratorLogViewerProps {
    reportId: string;
    isOpen: boolean;
    onClose: () => void;
}

// ============ LOG ITEM COMPONENT ============

function LogItem({ log, isLast }: { log: OrchestratorLog; isLast: boolean }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const getIcon = () => {
        switch (log.type) {
            case 'success':
                return <Check className="w-3 h-3 text-green-500" />;
            case 'warning':
                return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
            case 'error':
                return <X className="w-3 h-3 text-red-500" />;
            case 'ai_decision':
                return <Bot className="w-3 h-3 text-purple-500" />;
            default:
                return <Info className="w-3 h-3 text-blue-400" />;
        }
    };

    const getBgColor = () => {
        switch (log.type) {
            case 'success':
                return 'bg-green-900/20 border-green-800/30';
            case 'warning':
                return 'bg-yellow-900/20 border-yellow-800/30';
            case 'error':
                return 'bg-red-900/20 border-red-800/30';
            case 'ai_decision':
                return 'bg-purple-900/20 border-purple-800/30';
            default:
                return 'bg-gray-900/50 border-gray-800/30';
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const hasDetails = log.data && Object.keys(log.data).length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`relative pl-6 ${!isLast ? 'pb-3' : ''}`}
        >
            {/* Timeline line */}
            {!isLast && (
                <div className="absolute left-[7px] top-5 bottom-0 w-px bg-gray-700" />
            )}

            {/* Timeline dot */}
            <div className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${getBgColor()}`}>
                {getIcon()}
            </div>

            {/* Content */}
            <div className={`rounded-lg border p-2 ${getBgColor()}`}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-gray-500">{formatTime(log.timestamp)}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{log.step}</span>
                        </div>
                        <p className="text-xs text-white break-words">{log.message}</p>
                    </div>

                    {hasDetails && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 text-gray-500 hover:text-white transition-colors flex-shrink-0"
                        >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                    )}
                </div>

                {/* Expandable details */}
                <AnimatePresence>
                    {isExpanded && log.data && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <pre className="text-[10px] text-gray-400 font-mono overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(log.data, null, 2)}
                                </pre>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// ============ MAIN COMPONENT ============

export default function OrchestratorLogViewer({ reportId, isOpen, onClose }: OrchestratorLogViewerProps) {
    const [logs, setLogs] = useState<OrchestratorLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!reportId || !isOpen) return;

        setIsLoading(true);
        setError(null);

        // Real-time listener for orchestrator logs
        const unsub = onSnapshot(
            doc(db, 'reports', reportId),
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    const orchestratorLogs = data.orchestratorLogs || [];
                    setLogs(orchestratorLogs.sort((a: OrchestratorLog, b: OrchestratorLog) => a.timestamp - b.timestamp));
                    setIsLoading(false);
                } else {
                    setError('Report not found');
                    setIsLoading(false);
                }
            },
            (err) => {
                console.error('[LogViewer] Error:', err);
                setError('Failed to load logs');
                setIsLoading(false);
            }
        );

        return () => unsub();
    }, [reportId, isOpen]);

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-500" />
                        <h2 className="text-sm font-bold text-white">AI Orchestrator Log</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-500 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />
                            <span className="ml-2 text-sm text-gray-500">Loading logs...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8">
                            <Bot className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No orchestrator logs yet</p>
                            <p className="text-xs text-gray-600 mt-1">Logs will appear as the AI processes your request</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {logs.map((log, i) => (
                                <LogItem key={`${log.timestamp}-${i}`} log={log} isLast={i === logs.length - 1} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer - Stats */}
                {!isLoading && logs.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/50">
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                            <span>{logs.length} log entries</span>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    {logs.filter(l => l.type === 'success').length} success
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                    {logs.filter(l => l.type === 'ai_decision').length} AI decisions
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                    {logs.filter(l => l.type === 'warning').length} warnings
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
