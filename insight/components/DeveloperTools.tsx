"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Terminal, X, Minimize2, Maximize2, Trash2, Minus, Power, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
type LogType = 'info' | 'error' | 'warn' | 'success';

interface LogEntry {
    id: string;
    timestamp: string;
    message: string;
    type: LogType;
    details?: unknown;
}

interface DeveloperContextType {
    isDevMode: boolean;
    isVisible: boolean;
    enableDevMode: () => boolean;
    disableDevMode: () => void;
    toggleVisibility: () => void;
    logs: LogEntry[];
    addLog: (message: string, type?: LogType, details?: unknown) => void;
    clearLogs: () => void;
}

// --- Context ---
const DeveloperContext = createContext<DeveloperContextType | undefined>(undefined);

export function useDeveloper() {
    const context = useContext(DeveloperContext);
    if (!context) throw new Error('useDeveloper must be used within DeveloperProvider');
    return context;
}

// --- Provider ---
export function DeveloperProvider({ children }: { children: ReactNode }) {
    const [isDevMode, setIsDevMode] = useState(false);
    const [isVisible, setIsVisible] = useState(false); // Controls if console is shown at all
    const [logs, setLogs] = useState<LogEntry[]>([]);

    // Load dev mode state from local storage (persists across sessions)
    useEffect(() => {
        const savedMode = localStorage.getItem('pyg_dev_mode') === 'true';
        setIsDevMode(savedMode);
    }, []);

    // Intercept Console Logs when dev mode is active
    useEffect(() => {
        if (!isDevMode) return;

        const originalLog = console.log;
        const originalError = console.error;

        console.log = (...args) => {
            addLog(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '), 'info');
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            addLog(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '), 'error');
            originalError.apply(console, args);
        };

        const handleGlobalError = (event: ErrorEvent) => {
            addLog(`Uncaught Error: ${event.message}`, 'error');
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            addLog(`Unhandled Promise Rejection: ${event.reason}`, 'error');
        };

        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            console.log = originalLog;
            console.error = originalError;
            window.removeEventListener('error', handleGlobalError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [isDevMode]);

    const addLog = (message: string, type: LogType = 'info', details?: unknown) => {
        const newLog: LogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            message,
            type,
            details
        };
        setLogs(prev => [newLog, ...prev].slice(0, 100));
    };

    const enableDevMode = () => {
        setIsDevMode(true);
        localStorage.setItem('pyg_dev_mode', 'true');
        addLog('Developer Mode Enabled', 'success');
        return true;
    };

    const disableDevMode = () => {
        setIsDevMode(false);
        setIsVisible(false);
        localStorage.removeItem('pyg_dev_mode');
    };

    const toggleVisibility = () => setIsVisible(prev => !prev);
    const clearLogs = () => setLogs([]);

    return (
        <DeveloperContext.Provider value={{ isDevMode, isVisible, enableDevMode, disableDevMode, toggleVisibility, logs, addLog, clearLogs }}>
            {children}
            {isDevMode && <DeveloperConsole />}
        </DeveloperContext.Provider>
    );
}

// --- Console UI Component ---
function DeveloperConsole() {
    const { isVisible, logs, clearLogs, disableDevMode, toggleVisibility } = useDeveloper();
    const [isMinimized, setIsMinimized] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const prevLogCount = React.useRef(logs.length);

    // Watch for NEW logs while minimized
    useEffect(() => {
        if (isMinimized && logs.length > prevLogCount.current) {
            setHasUnread(true);
        }
        prevLogCount.current = logs.length;
    }, [logs.length, isMinimized]);

    // Clear unread when console is opened
    useEffect(() => {
        if (!isMinimized) {
            setHasUnread(false);
        }
    }, [isMinimized]);

    // Reset to minimized on mount (navigation)
    useEffect(() => {
        setIsMinimized(true);
    }, []);

    // Minimized UI - Clean & Minimal
    if (isMinimized) {
        return (
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.05 }}
                drag
                dragConstraints={{ left: -window.innerWidth + 50, right: 0, top: -window.innerHeight + 50, bottom: 0 }}
                className="fixed bottom-6 right-6 z-[9999] cursor-pointer group"
                onClick={() => setIsMinimized(false)}
            >
                <div className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center shadow-lg hover:bg-black/80 hover:border-white/20 transition-all">
                    <Terminal className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />

                    {/* Subtle Red Dot for Activity */}
                    {hasUnread && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                    )}
                </div>
            </motion.div>
        );
    }

    // Expanded Console State
    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 20, opacity: 0, scale: 0.95 }}
                className={`fixed z-[9999] bg-gray-950/95 backdrop-blur-xl border border-white/10 shadow-2xl font-mono text-xs flex flex-col transition-all duration-300 overflow-hidden
                    ${isFullScreen ? 'inset-0 w-full h-full rounded-none' : 'bottom-6 right-6 w-[95vw] md:w-[600px] rounded-xl'}
                    ${isFullScreen ? 'h-full' : 'max-h-[70vh] h-[400px]'}
                `}
            >
                {/* Header */}
                <div
                    className="bg-white/5 border-b border-white/5 p-3 flex items-center justify-between cursor-pointer select-none"
                    onDoubleClick={() => setIsFullScreen(!isFullScreen)}
                >
                    <div className="flex items-center gap-3">
                        {/* Traffic Lights */}
                        <div className="flex items-center gap-1.5 group">
                            <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors" onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}>
                                <X className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
                            </div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 flex items-center justify-center transition-colors" onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}>
                                <Minus className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
                            </div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 flex items-center justify-center transition-colors" onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }}>
                                {isFullScreen ?
                                    <Minimize2 className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" /> :
                                    <Maximize2 className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
                                }
                            </div>
                        </div>
                        <span className="text-gray-400 font-medium ml-2">Developer Console</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const text = logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`).join('\n');
                                navigator.clipboard.writeText(text);
                            }}
                            className="p-1.5 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-colors"
                            title="Copy Logs"
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); clearLogs(); }}
                            className="p-1.5 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-colors"
                            title="Clear Logs"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); disableDevMode(); }}
                            className="p-1.5 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 transition-colors ml-1"
                            title="Disable Dev Mode"
                        >
                            <Power className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Logs Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600">
                            <Terminal className="w-8 h-8 mb-2 opacity-20" />
                            <span className="text-sm opacity-50">Waiting for logs...</span>
                        </div>
                    )}
                    {logs.map(log => (
                        <div
                            key={log.id}
                            className={`flex gap-3 items-start py-1 px-2 rounded hover:bg-white/5 transition-colors font-mono
                                ${log.type === 'error' ? 'bg-red-500/5 text-red-200' : ''}
                                ${log.type === 'warn' ? 'bg-yellow-500/5 text-yellow-200' : ''}
                                ${log.type === 'success' ? 'bg-green-500/5 text-green-200' : ''}
                                ${log.type === 'info' ? 'text-gray-300' : ''}
                            `}
                        >
                            <span className="text-gray-600 shrink-0 min-w-[60px] text-[10px] select-none">{log.timestamp}</span>
                            <span className="whitespace-pre-wrap break-words leading-relaxed select-text">
                                {log.message}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="border-t border-white/5 px-4 py-1.5 flex items-center justify-between text-[10px] text-gray-600 bg-black/20">
                    <span>{logs.length} entries</span>
                    <span>v1.0.0</span>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
