import React from 'react';
import Link from 'next/link';
import { Report } from '@/hooks/useReports';

import { Trash2, Globe, Lock } from 'lucide-react';

interface ReportCardProps {
    report: Report;
    onDelete?: (id: string) => void;
}

import { useDeveloper } from './DeveloperTools';

export default function ReportCard({ report, onDelete }: ReportCardProps) {
    const { isDevMode } = useDeveloper();
    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete?.(report.id);
    };

    const isWeekly = report.type === 'weekly';

    return (
        <Link href={`/report/${report.id}`} className="block group relative">
            <div className="border border-gray-800 p-6 rounded-sm hover:border-white transition-colors cursor-pointer bg-black h-full">
                <div className="flex justify-between items-start mb-4">
                    <span className="text-primary font-mono text-sm">{report.date}</span>
                    <div className="flex items-center gap-2">
                        {isWeekly ? (
                            <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-900/30 text-red-400 border border-red-900/50">
                                AUTO
                            </span>
                        ) : (
                            <span className="px-2 py-1 rounded text-[10px] font-bold bg-green-900/30 text-green-400 border border-green-900/50">
                                MANUAL
                            </span>
                        )}
                        {report.isPublic ? (
                            <Globe className="w-3 h-3 text-green-500" />
                        ) : (
                            <Lock className="w-3 h-3 text-gray-500" />
                        )}
                        {report.type === 'manual' && onDelete && (
                            <button
                                onClick={handleDelete}
                                className="text-gray-500 hover:text-red-500 transition-colors p-1"
                                title="Delete Report"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-2 group-hover:underline decoration-primary decoration-2 underline-offset-4 line-clamp-2">
                    {report.topic === 'General' ? 'Weekly Digest' : report.topic}
                </h3>

                <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-3">
                    {report.summary}
                </p>

                <div className="flex items-center justify-between mt-auto">
                    <div className="text-xs font-mono text-gray-500 uppercase tracking-widest group-hover:text-white transition-colors">
                        [Read Report]
                    </div>
                    <Link
                        href={`/report/${report.id}/logs`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-mono text-gray-600 hover:text-primary uppercase tracking-widest z-10 px-2 py-1 hover:bg-gray-900 rounded transition-colors"
                    >
                        Details
                    </Link>
                </div>
            </div>
        </Link>
    );
}

