import React from 'react';
import { Report } from '../hooks/useReports';
import { FileText, Trash2, Share2, Globe, Lock } from 'lucide-react';
import Link from 'next/link';
import { motion, useAnimation, PanInfo } from 'framer-motion';

interface ReportListItemProps {
    report: Report;
    onDelete?: (id: string) => void;
}

export default function ReportListItem({ report, onDelete }: ReportListItemProps) {
    const isWeekly = report.type === 'weekly';
    const controls = useAnimation();
    const [isDesktop, setIsDesktop] = React.useState(false);

    React.useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.innerWidth > 768);
        checkDesktop();
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    const formatDateRange = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const endDate = new Date(date);
            endDate.setDate(date.getDate() + 7);

            const options: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric', year: 'numeric' };
            return `${date.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
        } catch {
            return dateString;
        }
    };

    const cleanPreviewText = (text: string) => {
        return text.replace(/[*#_`]/g, '').trim();
    };

    // Determine which buttons to show
    const showDelete = report.type === 'manual' && onDelete;
    const showShare = true; // Always allow sharing (content/link)

    // Calculate swipe threshold based on visible buttons (70px per button)
    const swipeThreshold = (showShare ? 70 : 0) + (showDelete ? 70 : 0);

    const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (isDesktop) return; // No drag on desktop

        const offset = info.offset.x;
        const velocity = info.velocity.x;

        // If dragged more than 1/3 of threshold or fast velocity
        if (offset < -(swipeThreshold / 3) || velocity < -500) {
            await controls.start({ x: -swipeThreshold });
        } else {
            await controls.start({ x: 0 });
        }
    };

    const handleShare = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (navigator.share) {
            try {
                await navigator.share({
                    title: report.topic,
                    text: report.summary,
                    url: window.location.origin + `/report/${report.id}`,
                });
            } catch (err) {
                console.error('Error sharing:', err);
            }
        } else {
            // Fallback to copy link
            navigator.clipboard.writeText(window.location.origin + `/report/${report.id}`);
            alert('Link copied to clipboard!');
        }
        controls.start({ x: 0 });
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onDelete) {
            onDelete(report.id);
        }
        // Reset position not needed as item will be removed
    };

    return (
        <div className="relative overflow-hidden mb-4 rounded-lg bg-black">
            {/* Background Actions */}
            <div className="absolute inset-0 flex justify-end">
                {showShare && (
                    <button
                        onClick={handleShare}
                        className={`w-[70px] h-full bg-[#166534] flex items-center justify-center text-white ${!showDelete ? 'rounded-r-lg' : ''}`}
                    >
                        <Share2 className="w-7 h-7" />
                    </button>
                )}
                {showDelete && (
                    <button
                        onClick={handleDelete}
                        className={`w-[70px] h-full bg-[#B91C1C] flex items-center justify-center text-white rounded-r-lg`}
                    >
                        <Trash2 className="w-7 h-7" />
                    </button>
                )}
            </div>

            {/* Foreground Content */}
            <motion.div
                drag={isDesktop ? false : "x"}
                dragConstraints={{ left: -swipeThreshold, right: 0 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                animate={controls}
                className="relative bg-gray-900 border border-white/5 p-4 flex items-start gap-4 z-10"
            >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isWeekly ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                    <FileText className="w-5 h-5" />
                </div>

                <Link href={`/report/${report.id}`} className="flex-1 min-w-0 block">
                    <h3 className="text-sm font-bold text-white truncate mb-1 block w-full">
                        {report.topic}
                    </h3>

                    <div className="flex items-center gap-2 mb-2">
                        {isWeekly ? (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-900/30 text-red-400 border border-red-900/50">
                                AUTO
                            </span>
                        ) : (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-900/30 text-green-400 border border-green-900/50">
                                MANUAL
                            </span>
                        )}

                        {report.isPublic ? (
                            <Globe className="w-3 h-3 text-green-500 shrink-0" />
                        ) : (
                            <Lock className="w-3 h-3 text-gray-500 shrink-0" />
                        )}

                        <span className="text-gray-600 text-[10px]">•</span>

                        <span className="text-[10px] font-mono text-gray-500 truncate">
                            {formatDateRange(report.date)}
                        </span>
                    </div>

                    <p className="text-xs text-gray-400 font-medium line-clamp-1">
                        {cleanPreviewText(report.summary)}
                    </p>
                </Link>
            </motion.div>
        </div>
    );
}
