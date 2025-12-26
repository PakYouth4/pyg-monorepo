"use client";

import { useState, useEffect } from "react";
import { useReports } from "@/hooks/useReports";
import ReportCard from "@/components/ReportCard";
import ReportListItem from "@/components/ReportListItem";
import ManualResearchModal from "@/components/ManualResearchModal";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { User, Menu, Search, LogOut, Filter, Bell, X, Eye, Sparkles } from "lucide-react";
import { auth } from "@/lib/firebase";
import FilterModal from "@/components/FilterModal";

import { NotificationProvider, useNotifications } from "@/context/NotificationContext";
import Link from "next/link";
import { DeveloperProvider, useDeveloper } from "@/components/DeveloperTools";
import BackendStatusBadge from "@/components/BackendStatusBadge";
import OrchestratorLogViewer from "@/components/OrchestratorLogViewer";
import AISuggestionsViewer from "@/components/AISuggestionsViewer";

// Notification Bell Component
function NotificationBell() {
    const { notifications, unreadCount, markAllAsRead, dismissNotification, isScanning } = useNotifications();
    const { isDevMode } = useDeveloper();
    const [isOpen, setIsOpen] = useState(false);

    // Find active scan to get progress
    const activeScan = notifications.find(n => !n.isComplete);
    const activeRingProgress = activeScan ? activeScan.progress : 0;

    // Progress Ring Component
    const ProgressRing = ({ progress }: { progress: number }) => {
        const radius = 14; // For a 32x32 container (w-8 h-8)
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (progress / 100) * circumference;

        return (
            <div className="relative w-8 h-8 flex items-center justify-center">
                {/* Background Ring */}
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        className="text-gray-800"
                        strokeWidth="4"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="16" // Adjusted for w-8 h-8 (32px)
                        cy="16" // Adjusted for w-8 h-8 (32px)
                    />
                    {/* Progress Ring */}
                    <circle
                        className="text-red-500 transition-all duration-500 ease-out"
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="16" // Adjusted for w-8 h-8 (32px)
                        cy="16" // Adjusted for w-8 h-8 (32px)
                    />
                </svg>
            </div>
        );
    };

    return (
        <div className="relative">
            <button
                onClick={() => { setIsOpen(!isOpen); markAllAsRead(); }}
                className="relative p-1 text-gray-400 hover:text-white transition-colors flex items-center justify-center"
            >
                {isScanning ? (
                    <ProgressRing progress={activeRingProgress} />
                ) : (
                    <>
                        <Bell className="w-6 h-6" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black"></span>
                        )}
                    </>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute left-0 md:left-auto md:right-0 mt-2 w-[calc(100vw-2rem)] md:w-80 max-w-[320px] bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden"
                        >
                            <div className="p-3 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">ACTIVE TASK</h3>
                                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="max-h-80 overflow-y-auto overflow-x-hidden">
                                {notifications.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-xs">No active tasks</div>
                                ) : (
                                    notifications.map(n => (
                                        <SwipeableNotificationItem key={n.id} n={n} onDismiss={dismissNotification} isDevMode={isDevMode} />
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

// Swipeable Notification Item Component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SwipeableNotificationItem({ n, onDismiss, isDevMode }: { n: any, onDismiss: (id: string) => void, isDevMode: boolean }) {
    const [isMobile, setIsMobile] = useState(false);
    const [showLogViewer, setShowLogViewer] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <>
            <div className="relative overflow-hidden border-b border-white/5">
                {/* Background Action (Delete) - Only visible on mobile */}
                {isMobile && (
                    <div className="absolute inset-0 bg-red-900/50 flex items-center justify-end px-4">
                        <X className="w-5 h-5 text-red-500" />
                    </div>
                )}

                {/* Foreground Content */}
                <motion.div
                    drag={isMobile && n.isComplete ? "x" : false} // Only allow drag if complete AND on mobile
                    dragConstraints={{ left: -100, right: 0 }}
                    dragElastic={0.1} // Add resistance
                    onDragEnd={(e, { offset }) => {
                        // Increased threshold to -100 (harder to trigger accidentally)
                        if (offset.x < -100) {
                            onDismiss(n.id);
                        }
                    }}
                    className="relative bg-gray-900 p-4 hover:bg-white/5 transition-colors"
                >
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-bold text-white truncate w-3/4">{n.topic}</h4>
                        {n.isComplete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                                className="text-gray-500 hover:text-white p-2 -mr-2 -mt-2" // Increased touch target
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>{n.status}</span>
                        <span>{n.progress}%</span>
                    </div>
                    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-2">
                        <div
                            className={`h-full transition-all duration-500 ${n.error ? 'bg-red-500' : 'bg-green-500'}`} // Changed to green for success
                            style={{ width: `${n.progress}%` }}
                        />
                    </div>

                    {!n.isComplete && (
                        <div className="flex justify-end mt-2 gap-2">
                            {n.reportId && isDevMode && (
                                <Link
                                    href={`/report/${n.reportId}/logs`}
                                    className="text-[10px] font-bold text-gray-500 hover:text-primary uppercase tracking-wider transition-colors py-1 px-2 flex items-center gap-1"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    LOGS
                                </Link>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                                className="text-[10px] font-bold text-gray-500 hover:text-red-400 uppercase tracking-wider transition-colors py-1 px-2"
                            >
                                CANCEL
                            </button>
                        </div>
                    )}

                    {/* View Details button - always visible when we have a reportId */}
                    {n.reportId && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowLogViewer(true); }}
                            className="flex items-center gap-1 text-[10px] font-bold text-purple-400 hover:text-purple-300 uppercase tracking-wider transition-colors py-1 mt-2"
                        >
                            <Eye className="w-3 h-3" />
                            View AI Details
                        </button>
                    )}

                    {n.isComplete && !n.error && n.reportId && (
                        <Link
                            href={`/report/${n.reportId}`}
                            className="block w-full text-center py-2 bg-green-900/20 text-green-500 text-xs font-bold uppercase tracking-wider rounded hover:bg-green-900/40 transition-colors mt-2"
                        >
                            View Report
                        </Link>
                    )}
                </motion.div>
            </div>

            {/* Orchestrator Log Viewer Modal */}
            {n.reportId && (
                <OrchestratorLogViewer
                    reportId={n.reportId}
                    isOpen={showLogViewer}
                    onClose={() => setShowLogViewer(false)}
                />
            )}
        </>
    );
}

export default function Dashboard() {
    return (
        <DeveloperProvider>
            <NotificationProvider>
                <DashboardContent />
            </NotificationProvider>
        </DeveloperProvider>
    );
}

function DashboardContent() {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const { enableDevMode, isDevMode } = useDeveloper();
    const [tapCount, setTapCount] = useState(0);

    const handleLogoTap = () => {
        if (isDevMode) return;

        const newCount = tapCount + 1;
        setTapCount(newCount);

        if (newCount === 7) {
            if (confirm("Enable Developer Mode?")) {
                enableDevMode();
            }
            setTapCount(0);
        }
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const { reports, loading: reportsLoading, error, deleteReport } = useReports();
    const { user, loading: authLoading } = useAuth(true); // Require auth

    const handleDeleteRequest = async (id: string) => {
        if (confirm('Are you sure you want to delete this report?')) {
            try {
                await deleteReport(id);
            } catch (error) {
                console.error("Failed to delete:", error);
                alert("Failed to delete report.");
            }
        }
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        type: 'all' as 'all' | 'manual' | 'weekly',
        visibility: 'all' as 'all' | 'public' | 'private'
    });
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

    const [greetingText, setGreetingText] = useState('');
    const fullGreeting = "Assalamualaikum,";

    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            setGreetingText(fullGreeting.slice(0, i + 1));
            i++;
            if (i > fullGreeting.length) clearInterval(interval);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    // KPI Calculations
    const totalReports = reports.length;
    const manualReports = reports.filter(r => r.type === 'manual').length;
    const weeklyReports = reports.filter(r => r.type === 'weekly').length;

    // Filter Logic
    const filteredReports = reports.filter(report => {
        const matchesSearch = (report.topic || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (report.summary || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = filters.type === 'all' || report.type === filters.type;

        const matchesVisibility = filters.visibility === 'all' ||
            (filters.visibility === 'public' && report.isPublic) ||
            (filters.visibility === 'private' && !report.isPublic);

        return matchesSearch && matchesType && matchesVisibility;
    });

    if (authLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black">
                <h1 className="text-4xl font-bold text-white tracking-tight mb-8">Insight.</h1>
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect in hook
    }

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };



    return (
        <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen p-8 md:p-12 max-w-7xl mx-auto relative"
        >
            {/* Navigation Drawer */}
            {isDrawerOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsDrawerOpen(false)}
                        className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "-100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 left-0 w-72 bg-black border-r border-white/10 z-50 p-8 flex flex-col"
                    >
                        <div className="mb-8">
                            <h2
                                onClick={handleLogoTap}
                                className="text-2xl font-bold text-white tracking-tight mb-2 cursor-pointer select-none active:scale-95 transition-transform"
                            >
                                Insight.
                            </h2>
                            <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-4">Navigation</p>
                            <p className="text-sm text-gray-400 font-medium truncate">{user.displayName || user.email}</p>
                        </div>

                        <div className="flex-1 space-y-2">
                            <a href="/settings" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg">
                                <User className="w-5 h-5" />
                                <span className="font-medium">Profile & Settings</span>
                            </a>
                            <button
                                onClick={() => auth.signOut()}
                                className="flex items-center gap-3 text-gray-400 hover:text-red-500 transition-colors w-full p-2 hover:bg-white/5 rounded-lg text-left"
                            >
                                <LogOut className="w-5 h-5" />
                                <span className="font-medium">Log Out</span>
                            </button>
                        </div>
                    </motion.div>
                </>
            )}

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-start mb-12 border-b border-gray-800 pb-8 relative">
                <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                        <button
                            onClick={() => setIsDrawerOpen(true)}
                            className="text-white hover:text-gray-300 transition-colors p-1"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="flex flex-col">
                            <motion.span
                                initial={{ opacity: 1 }}
                                className="text-sm font-light text-gray-400 h-5 block"
                            >
                                {greetingText}
                            </motion.span>
                            <motion.h1
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="text-3xl font-bold text-white tracking-tight"
                            >
                                {user.displayName ? user.displayName.split(' ')[0] : (user.email ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1) : 'User')}
                            </motion.h1>
                        </div>
                    </div>

                </div>

                {/* Top Right Actions */}
                <div className="w-full md:w-auto mt-8 md:mt-0 flex flex-col items-start md:items-end gap-2">
                    <div className="flex items-center gap-4">
                        {/* AI Suggestions Button - Dev Mode Only */}
                        {isDevMode && (
                            <button
                                onClick={() => setIsSuggestionsOpen(true)}
                                className="relative p-2 text-gray-400 hover:text-purple-400 transition-colors"
                                title="AI Improvement Suggestions"
                            >
                                <Sparkles className="w-5 h-5" />
                            </button>
                        )}
                        <NotificationBell />
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="btn-primary text-sm uppercase tracking-wider"
                        >
                            NEW MANUAL RESEARCH
                        </button>
                    </div>
                    <BackendStatusBadge compact />
                </div>
            </header>

            {/* AI Suggestions Viewer Modal */}
            <AISuggestionsViewer
                isOpen={isSuggestionsOpen}
                onClose={() => setIsSuggestionsOpen(false)}
            />

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-12">
                <div className="bg-gray-900/30 border border-white/5 p-4 rounded-lg flex flex-col items-center justify-center text-center w-full">
                    <div className="flex flex-col items-center justify-center w-full">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1 text-center">Total Reports</p>
                        <p className="text-2xl font-bold text-white text-center">{totalReports}</p>
                    </div>
                </div>
                <div className="bg-gray-900/30 border border-white/5 p-4 rounded-lg flex flex-col items-center justify-center text-center w-full">
                    <div className="flex flex-col items-center justify-center w-full">
                        <p className="text-xs text-green-500/70 font-bold uppercase tracking-widest mb-1 text-center">Manual Scans</p>
                        <p className="text-2xl font-bold text-white text-center">{manualReports}</p>
                    </div>
                </div>
                <div className="bg-gray-900/30 border border-white/5 p-4 rounded-lg flex flex-col items-center justify-center text-center w-full">
                    <div className="flex flex-col items-center justify-center w-full">
                        <p className="text-xs text-red-500/70 font-bold uppercase tracking-widest mb-1 text-center">Weekly Reports</p>
                        <p className="text-2xl font-bold text-white text-center">{weeklyReports}</p>
                    </div>
                </div>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search reports..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:border-primary focus:outline-none transition-colors placeholder-gray-600"
                    />
                </div>
                <button
                    onClick={() => setIsFilterModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-900/50 border border-white/10 rounded-lg text-sm font-bold text-white hover:bg-white/5 transition-colors uppercase tracking-wider"
                >
                    <Filter className="w-4 h-4" />
                    Filters
                    {(filters.type !== 'all' || filters.visibility !== 'all') && (
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                    )}
                </button>
            </div>

            {/* Reports Grid */}
            <div>
                <div className="flex items-center justify-between mb-8 w-full">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                        Intelligence Logs
                    </h2>
                    {reportsLoading ? (
                        <div className="h-4 w-20 bg-white/10 rounded animate-pulse"></div>
                    ) : (
                        <span className="text-xs font-mono text-gray-600">
                            {filteredReports.length} RECORDS
                        </span>
                    )}
                </div>

                {reportsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-gray-900/30 border border-white/5 p-6 rounded-xl h-64 animate-pulse">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-4 w-20 bg-white/10 rounded"></div>
                                    <div className="h-4 w-4 bg-white/10 rounded-full"></div>
                                </div>
                                <div className="h-8 w-3/4 bg-white/10 rounded mb-4"></div>
                                <div className="space-y-2">
                                    <div className="h-3 w-full bg-white/5 rounded"></div>
                                    <div className="h-3 w-full bg-white/5 rounded"></div>
                                    <div className="h-3 w-2/3 bg-white/5 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-red-500 font-mono">Error loading reports: {error}</div>
                ) : (
                    <>
                        {/* Mobile List View */}
                        <motion.div
                            variants={container}
                            initial="hidden"
                            animate="show"
                            className="block md:hidden -mx-8 border-t border-white/10"
                        >
                            {filteredReports.map((report) => (
                                <motion.div key={report.id} variants={item}>
                                    <ReportListItem report={report} onDelete={handleDeleteRequest} />
                                </motion.div>
                            ))}
                            {filteredReports.length === 0 && (
                                <div className="py-12 text-center text-gray-500 text-sm">No reports found matching your criteria.</div>
                            )}
                        </motion.div>

                        {/* Desktop Grid View */}
                        <motion.div
                            variants={container}
                            initial="hidden"
                            animate="show"
                            className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {filteredReports.map((report) => (
                                <motion.div key={report.id} variants={item}>
                                    <ReportCard report={report} onDelete={handleDeleteRequest} />
                                </motion.div>
                            ))}
                            {filteredReports.length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-500 text-sm">No reports found matching your criteria.</div>
                            )}
                        </motion.div>
                    </>
                )}
            </div>

            {/* Modal */}
            <ManualResearchModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />

            <FilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                filters={filters}
                onApply={setFilters}
            />
        </motion.main>
    );
}
