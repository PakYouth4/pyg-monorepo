"use client";

import { useBackendStatus } from '@/hooks/useBackendStatus';
import { Server, AlertCircle, Moon, RefreshCw } from 'lucide-react';

interface BackendStatusBadgeProps {
    showLatency?: boolean;
    compact?: boolean;
}

export default function BackendStatusBadge({ showLatency = true, compact = false }: BackendStatusBadgeProps) {
    const { status, version, latency, refresh, lastChecked } = useBackendStatus();

    const statusConfig = {
        loading: {
            icon: <RefreshCw className="w-3 h-3 animate-spin text-yellow-500" />,
            color: 'text-yellow-500',
            bgColor: 'bg-yellow-500/10',
            label: 'Connecting...'
        },
        connected: {
            icon: <Server className="w-3 h-3 text-green-500" />,
            color: 'text-green-500',
            bgColor: 'bg-green-500/10',
            label: version
        },
        sleeping: {
            icon: <Moon className="w-3 h-3 text-blue-400" />,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            label: 'Space Sleeping'
        },
        error: {
            icon: <AlertCircle className="w-3 h-3 text-red-500" />,
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
            label: 'Offline'
        }
    };

    const config = statusConfig[status];

    if (compact) {
        return (
            <button
                onClick={refresh}
                className={`flex items-center gap-1.5 px-2 py-1 rounded ${config.bgColor} hover:opacity-80 transition-opacity`}
                title={`Backend: ${config.label}${latency ? ` (${latency}ms)` : ''}\nClick to refresh`}
            >
                {config.icon}
                <span className={`text-[10px] font-mono ${config.color}`}>
                    {status === 'connected' ? 'LIVE' : status.toUpperCase()}
                </span>
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={refresh}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor} hover:opacity-80 transition-opacity`}
                title={lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}\nClick to refresh` : 'Click to refresh'}
            >
                {config.icon}
                <span className={`text-xs font-mono ${config.color}`}>
                    {config.label}
                </span>
                {showLatency && latency && status === 'connected' && (
                    <span className="text-[10px] text-gray-500">
                        {latency}ms
                    </span>
                )}
            </button>
        </div>
    );
}
