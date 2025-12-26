"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Terminal, X, Minimize2, Maximize2, Trash2, Minus, Power } from 'lucide-react';
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
        // DON'T auto-open the console - keep it minimized/hidden until user clicks
        // setIsVisible is left as false - user must manually toggle
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
        // DON'T auto-open console - user will see the floating button
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
    // ALWAYS start minimized - even on page navigation
    const [isMinimized, setIsMinimized] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);

    // Reset to minimized when navigating (when component remounts)
    useEffect(() => {
        setIsMinimized(true);
        setIsFullScreen(false);
    }, []);

    // Minimized floating button state
    if (isMinimized) {
        return (
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.1 }}
                drag
                dragConstraints={{ left: -window.innerWidth + 80, right: 0, top: -window.innerHeight + 80, bottom: 0 }}
                className="fixed bottom-4 right-4 z-[9999] cursor-pointer"
                onClick={() => setIsMinimized(false)}
            >
                <div className="w-12 h-12 bg-gradient-to-br from-green-900 to-green-950 border border-green-500/50 rounded-full flex items-center justify-center shadow-lg shadow-green-900/30 backdrop-blur-sm hover:border-green-400 transition-colors">
                    <Terminal className="w-5 h-5 text-green-400" />
                    {/* Status Dot */}
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse" />
                    {/* Log count badge */}
                    {logs.length > 0 && (
                        <div className="absolute -bottom-1 -left-1 min-w-[18px] h-[18px] bg-red-600 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1">
                            {logs.length > 99 ? '99+' : logs.length}
                        </div>
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
                className={`fixed z-[9999] bg-gray-950 border border-green-500/30 shadow-2xl shadow-green-900/10 font-mono text-xs flex flex-col transition-all duration-300 overflow-hidden
                    ${isFullScreen ? 'inset-0 w-full h-full rounded-none' : 'bottom-4 right-4 w-[95vw] md:w-[600px] rounded-xl'}
                    ${isFullScreen ? 'h-full' : 'max-h-[70vh] h-[400px]'}
                `}
            >
                {/* Header */}
                <div
                    className="bg-gradient-to-r from-green-900/30 to-green-950/30 border-b border-green-500/20 p-3 flex items-center justify-between cursor-pointer select-none"
                    onDoubleClick={() => setIsFullScreen(!isFullScreen)}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500 hover:brightness-110" onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} />
                            <div className="w-3 h-3 rounded-full bg-yellow-500 hover:brightness-110" onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} />
                            <div className="w-3 h-3 rounded-full bg-green-500 hover:brightness-110" onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }} />
                        </div>
                        <div className="flex items-center gap-2 text-green-400">
                            <Terminal className="w-4 h-4" />
                            <span className="font-bold tracking-wide">DEV CONSOLE</span>
                            <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-[9px] font-medium">LIVE</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); clearLogs(); }}
                            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                            title="Clear Logs"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                            title="Minimize"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }}
                            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                            title="Toggle Full Screen"
                        >
                            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); disableDevMode(); }}
                            className="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors ml-1"
                            title="Disable Dev Mode"
                        >
                            <Power className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Logs Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-green-900/50 scrollbar-track-transparent">
                    {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600">
                            <Terminal className="w-8 h-8 mb-2 opacity-30" />
                            <span className="text-sm">Waiting for system events...</span>
                            <span className="text-[10px] mt-1 text-gray-700">Console logs will appear here</span>
                        </div>
                    )}
                    {logs.map(log => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex gap-3 items-start py-1.5 px-2 rounded hover:bg-white/5 transition-colors
                                ${log.type === 'error' ? 'bg-red-900/10' : ''}
                            `}
                        >
                            <span className="text-gray-600 shrink-0 min-w-[70px] text-[10px]">{log.timestamp}</span>
                            <span className={`whitespace-pre-wrap break-words leading-relaxed ${log.type === 'error' ? 'text-red-400' :
                                    log.type === 'success' ? 'text-green-400' :
                                        log.type === 'warn' ? 'text-yellow-400' :
                                            'text-gray-300'
                                }`}>
                                {log.type === 'error' && <span className="text-red-500 mr-1">●</span>}
                                {log.type === 'success' && <span className="text-green-500 mr-1">●</span>}
                                {log.type === 'warn' && <span className="text-yellow-500 mr-1">●</span>}
                                {log.type === 'info' && <span className="text-blue-500 mr-1">●</span>}
                                {log.message}
                            </span>
                        </motion.div>
                    ))}
                </div>

                {/* Footer */}
                <div className="border-t border-green-500/10 px-4 py-2 flex items-center justify-between text-[10px] text-gray-600 bg-black/30">
                    <span>{logs.length} log entries</span>
                    <span>Double-click header to toggle fullscreen</span>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
