"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

export interface BackendStatus {
    status: 'loading' | 'connected' | 'error' | 'sleeping';
    version: string;
    latency: number | null;
    lastChecked: Date | null;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://pakyouth-insightbackend.hf.space';

export function useBackendStatus(pingInterval: number = 10000) { // Reduced from 30s to 10s
    const [status, setStatus] = useState<BackendStatus>({
        status: 'loading',
        version: '...',
        latency: null,
        lastChecked: null
    });
    const consecutiveFailures = useRef(0);

    const checkBackend = useCallback(async () => {
        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // Reduced to 8s timeout

            const response = await fetch(BACKEND_URL, {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-store' // Prevent caching
            });

            clearTimeout(timeoutId);
            const latency = Date.now() - startTime;

            if (response.ok) {
                const text = await response.text();
                // Extract version from response like "Heavy Backend V5.0 (Multi-Provider LLM) Online 🚀"
                const versionMatch = text.match(/V[\d.]+\s*\([^)]+\)/);
                const version = versionMatch ? versionMatch[0] : 'Online';

                consecutiveFailures.current = 0; // Reset on success
                setStatus({
                    status: 'connected',
                    version,
                    latency,
                    lastChecked: new Date()
                });
            } else if (response.status === 503 || response.status === 502) {
                // HuggingFace space might be sleeping or restarting
                consecutiveFailures.current++;
                setStatus({
                    status: consecutiveFailures.current > 2 ? 'sleeping' : 'loading',
                    version: 'Restarting...',
                    latency: null,
                    lastChecked: new Date()
                });
            } else {
                consecutiveFailures.current++;
                setStatus({
                    status: 'error',
                    version: `HTTP ${response.status}`,
                    latency: null,
                    lastChecked: new Date()
                });
            }
        } catch (error) {
            consecutiveFailures.current++;
            // Show different message based on failure count
            const isRestarting = consecutiveFailures.current <= 3;
            setStatus({
                status: isRestarting ? 'loading' : 'error',
                version: isRestarting ? 'Restarting...' : 'Offline',
                latency: null,
                lastChecked: new Date()
            });
        }
    }, []);

    useEffect(() => {
        // Initial check
        checkBackend();

        // Set up interval - check more frequently (every 10s)
        const interval = setInterval(checkBackend, pingInterval);

        return () => clearInterval(interval);
    }, [checkBackend, pingInterval]);

    return { ...status, refresh: checkBackend };
}

