"use client";

import { useState, useEffect, useCallback } from 'react';

export interface BackendStatus {
    status: 'loading' | 'connected' | 'error' | 'sleeping';
    version: string;
    latency: number | null;
    lastChecked: Date | null;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://pakyouth-heavy-backend.hf.space';

export function useBackendStatus(pingInterval: number = 30000) {
    const [status, setStatus] = useState<BackendStatus>({
        status: 'loading',
        version: '...',
        latency: null,
        lastChecked: null
    });

    const checkBackend = useCallback(async () => {
        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(BACKEND_URL, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const latency = Date.now() - startTime;

            if (response.ok) {
                const text = await response.text();
                // Extract version from response like "Heavy Backend V5.0 (Multi-Provider LLM) Online 🚀"
                const versionMatch = text.match(/V[\d.]+\s*\([^)]+\)/);
                const version = versionMatch ? versionMatch[0] : 'Unknown';

                setStatus({
                    status: 'connected',
                    version,
                    latency,
                    lastChecked: new Date()
                });
            } else if (response.status === 503 || response.status === 502) {
                // HuggingFace space might be sleeping
                setStatus({
                    status: 'sleeping',
                    version: 'Sleeping',
                    latency: null,
                    lastChecked: new Date()
                });
            } else {
                setStatus({
                    status: 'error',
                    version: `HTTP ${response.status}`,
                    latency: null,
                    lastChecked: new Date()
                });
            }
        } catch (error) {
            // Check if it's a HuggingFace HTML page (space not running)
            setStatus({
                status: 'error',
                version: 'Offline',
                latency: null,
                lastChecked: new Date()
            });
        }
    }, []);

    useEffect(() => {
        // Initial check
        checkBackend();

        // Set up interval
        const interval = setInterval(checkBackend, pingInterval);

        return () => clearInterval(interval);
    }, [checkBackend, pingInterval]);

    return { ...status, refresh: checkBackend };
}
