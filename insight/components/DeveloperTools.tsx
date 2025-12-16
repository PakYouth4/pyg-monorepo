"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Terminal, X, Minimize2, Maximize2, Trash2, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

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
    const [isVisible, setIsVisible] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    // Load state from local storage
    useEffect(() => {
        const savedMode = localStorage.getItem('pyg_dev_mode') === 'true';
        setIsDevMode(savedMode);
        if (savedMode) setIsVisible(true);
    }, []);

    // Intercept Console Logs (Optional - be careful with infinite loops)
    useEffect(() => {
        if (!isDevMode) return;

        const originalLog = console.log;
        const originalError = console.error;

        console.log = (...args) => {
            // Filter out our own logs to prevent loops if needed
            // originalLog(...args); // Keep original behavior
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
        setLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
    };

    const enableDevMode = () => {
        setIsDevMode(true);
        setIsVisible(true);
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
    const { isVisible, logs, clearLogs, disableDevMode } = useDeveloper();
    const [isMinimized, setIsMinimized] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    if (!isVisible) return null;

    // Circular Icon State
    if (isMinimized) {
        return (
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }} // Allow free drag within window
                className="fixed bottom-4 right-4 z-[9999] cursor-pointer"
                onClick={() => setIsMinimized(false)}
            >
                <div className="w-12 h-12 bg-green-900/90 border border-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-900/50 backdrop-blur-sm">
                    <Terminal className="w-6 h-6 text-green-400" />
                    {/* Status Dot */}
                    <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse"></div>
                </div>
            </motion.div>
        );
    }

    // Expanded Console State
    return (
        <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className={`fixed z-[9999] bg-black/95 border border-green-500/30 shadow-2xl font-mono text-xs flex flex-col transition-all duration-300 
                ${isFullScreen ? 'inset-0 w-full h-full rounded-none' : 'bottom-4 right-4 w-[90vw] md:w-[600px] rounded-lg'}
                ${isFullScreen ? 'h-full' : 'h-[400px]'}
            `}
        >
            {/* Header */}
            <div className="bg-green-900/20 border-b border-green-500/20 p-2 flex items-center justify-between cursor-pointer" onDoubleClick={() => setIsFullScreen(!isFullScreen)}>
                <div className="flex items-center gap-2 text-green-400">
                    <Terminal className="w-4 h-4" />
                    <span className="font-bold">PYG_DEV_CONSOLE</span>
                    <span className="bg-green-500/20 text-green-400 px-1.5 rounded text-[9px]">LIVE</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); clearLogs(); }} className="p-1 hover:text-white text-gray-400" title="Clear Logs"><Trash2 className="w-3 h-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} className="p-1 hover:text-white text-gray-400" title="Minimize">
                        <Minus className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }} className="p-1 hover:text-white text-gray-400" title="Toggle Full Screen">
                        {isFullScreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); disableDevMode(); }} className="p-1 hover:text-red-500 text-gray-400" title="Disable Dev Mode"><X className="w-3 h-3" /></button>
                </div>
            </div>

            {/* Logs Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-green-900 scrollbar-track-transparent">
                {logs.length === 0 && (
                    <div className="text-gray-600 text-center mt-10 italic">Waiting for system events...</div>
                )}
                {logs.map(log => (
                    <div key={log.id} className="flex gap-3 items-start border-b border-white/5 pb-2 last:border-0 font-mono">
                        <span className="text-gray-500 shrink-0 min-w-[80px]">[{log.timestamp}]</span>
                        <span className={`whitespace-pre-wrap break-words ${log.type === 'error' ? 'text-red-400 font-bold' :
                            log.type === 'success' ? 'text-green-400 font-bold' :
                                log.type === 'warn' ? 'text-yellow-400' :
                                    'text-gray-300'
                            }`}>
                            {log.type === 'error' && '❌ '}
                            {log.type === 'success' && '✅ '}
                            {log.type === 'warn' && '⚠️ '}
                            {log.message}
                        </span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
