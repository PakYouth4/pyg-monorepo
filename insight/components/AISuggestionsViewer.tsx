'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lightbulb,
    Code,
    Cog,
    Zap,
    Settings,
    CheckCircle,
    XCircle,
    Clock,
    ChevronDown,
    ChevronUp,
    X,
    Sparkles
} from 'lucide-react';

// ============ TYPES ============

interface AISuggestion {
    id: string;
    timestamp: number;
    stepName: string;
    failurePattern: string;
    suggestionType: 'new_function' | 'code_change' | 'process_change' | 'new_api' | 'config_change';
    title: string;
    description: string;
    codeSnippet?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedImpact: string;
    status: 'pending' | 'reviewed' | 'implemented' | 'rejected';
}

interface AISuggestionsViewerProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============ HELPER FUNCTIONS ============

function getTypeIcon(type: AISuggestion['suggestionType']) {
    switch (type) {
        case 'new_function':
            return <Code className="w-4 h-4" />;
        case 'code_change':
            return <Settings className="w-4 h-4" />;
        case 'process_change':
            return <Cog className="w-4 h-4" />;
        case 'new_api':
            return <Zap className="w-4 h-4" />;
        case 'config_change':
            return <Settings className="w-4 h-4" />;
        default:
            return <Lightbulb className="w-4 h-4" />;
    }
}

function getPriorityColor(priority: AISuggestion['priority']) {
    switch (priority) {
        case 'critical':
            return 'bg-red-900/30 text-red-400 border-red-800/50';
        case 'high':
            return 'bg-orange-900/30 text-orange-400 border-orange-800/50';
        case 'medium':
            return 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50';
        case 'low':
            return 'bg-blue-900/30 text-blue-400 border-blue-800/50';
        default:
            return 'bg-gray-900/30 text-gray-400 border-gray-800/50';
    }
}

function getStatusIcon(status: AISuggestion['status']) {
    switch (status) {
        case 'implemented':
            return <CheckCircle className="w-4 h-4 text-green-500" />;
        case 'rejected':
            return <XCircle className="w-4 h-4 text-red-500" />;
        case 'reviewed':
            return <Clock className="w-4 h-4 text-blue-500" />;
        default:
            return <Clock className="w-4 h-4 text-yellow-500" />;
    }
}

// ============ SUGGESTION CARD ============

function SuggestionCard({ suggestion, onStatusChange }: {
    suggestion: AISuggestion;
    onStatusChange: (id: string, status: AISuggestion['status']) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    const formatTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (mins > 0) return `${mins}m ago`;
        return 'Just now';
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`border rounded-lg overflow-hidden ${getPriorityColor(suggestion.priority)}`}
        >
            {/* Header */}
            <div
                className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="p-1.5 rounded bg-white/10">
                            {getTypeIcon(suggestion.suggestionType)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-white truncate">{suggestion.title}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-500 uppercase">{suggestion.stepName}</span>
                                <span className="text-[10px] text-gray-600">•</span>
                                <span className="text-[10px] text-gray-500">{formatTime(suggestion.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {getStatusIcon(suggestion.status)}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 border-t border-white/10 pt-3 space-y-3">
                            {/* Failure Pattern */}
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase">Failure Pattern</label>
                                <p className="text-xs text-gray-300 mt-0.5">{suggestion.failurePattern}</p>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase">Recommendation</label>
                                <p className="text-xs text-white mt-0.5">{suggestion.description}</p>
                            </div>

                            {/* Code Snippet */}
                            {suggestion.codeSnippet && (
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase">Code Example</label>
                                    <pre className="mt-1 p-2 bg-black/30 rounded text-[10px] text-green-400 font-mono overflow-x-auto">
                                        {suggestion.codeSnippet}
                                    </pre>
                                </div>
                            )}

                            {/* Impact */}
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase">Expected Impact</label>
                                <p className="text-xs text-gray-300 mt-0.5">{suggestion.estimatedImpact}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                                {suggestion.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => onStatusChange(suggestion.id, 'implemented')}
                                            className="flex-1 py-1.5 px-3 bg-green-900/30 text-green-400 text-xs font-medium rounded hover:bg-green-900/50 transition-colors"
                                        >
                                            ✓ Mark Implemented
                                        </button>
                                        <button
                                            onClick={() => onStatusChange(suggestion.id, 'rejected')}
                                            className="flex-1 py-1.5 px-3 bg-red-900/30 text-red-400 text-xs font-medium rounded hover:bg-red-900/50 transition-colors"
                                        >
                                            ✕ Reject
                                        </button>
                                    </>
                                )}
                                {suggestion.status !== 'pending' && (
                                    <button
                                        onClick={() => onStatusChange(suggestion.id, 'pending')}
                                        className="flex-1 py-1.5 px-3 bg-gray-900/30 text-gray-400 text-xs font-medium rounded hover:bg-gray-900/50 transition-colors"
                                    >
                                        Reset Status
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ============ MAIN COMPONENT ============

export default function AISuggestionsViewer({ isOpen, onClose }: AISuggestionsViewerProps) {
    const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'implemented' | 'rejected'>('all');

    useEffect(() => {
        if (!isOpen) return;

        setIsLoading(true);

        const q = query(
            collection(db, 'ai_suggestions'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            })) as AISuggestion[];
            setSuggestions(data);
            setIsLoading(false);
        }, (err) => {
            console.error('[AISuggestions] Error:', err);
            setIsLoading(false);
        });

        return () => unsub();
    }, [isOpen]);

    const handleStatusChange = async (id: string, status: AISuggestion['status']) => {
        try {
            await updateDoc(doc(db, 'ai_suggestions', id), { status });
        } catch (e) {
            console.error('[AISuggestions] Failed to update status:', e);
        }
    };

    const filteredSuggestions = suggestions.filter(s => {
        if (filter === 'all') return true;
        return s.status === filter;
    });

    const stats = {
        pending: suggestions.filter(s => s.status === 'pending').length,
        implemented: suggestions.filter(s => s.status === 'implemented').length,
        rejected: suggestions.filter(s => s.status === 'rejected').length,
        total: suggestions.length
    };

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
                className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        <h2 className="text-sm font-bold text-white">AI Improvement Suggestions</h2>
                        <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 text-[10px] font-medium rounded-full">
                            {stats.pending} pending
                        </span>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex border-b border-gray-800">
                    {(['all', 'pending', 'implemented', 'rejected'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${filter === f
                                    ? 'text-white border-b-2 border-purple-500'
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {f} {f !== 'all' && `(${stats[f]})`}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredSuggestions.length === 0 ? (
                        <div className="text-center py-12">
                            <Sparkles className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                            <p className="text-sm text-gray-500">No suggestions yet</p>
                            <p className="text-xs text-gray-600 mt-1">
                                AI will generate suggestions when it detects repeated failures
                            </p>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {filteredSuggestions.map(s => (
                                <SuggestionCard
                                    key={s.id}
                                    suggestion={s}
                                    onStatusChange={handleStatusChange}
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                {/* Footer Stats */}
                {!isLoading && suggestions.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/50">
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                            <span>{stats.total} total suggestions</span>
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                    {stats.pending} pending
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    {stats.implemented} implemented
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    {stats.rejected} rejected
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
