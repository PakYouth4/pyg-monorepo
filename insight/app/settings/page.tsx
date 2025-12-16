"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { LogOut, User, Info, Shield, ChevronLeft, Terminal, Server, AlertCircle } from 'lucide-react';
import { useDeveloper } from '@/components/DeveloperTools';

export default function SettingsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [backendVersion, setBackendVersion] = useState<string>('Loading...');
    const [backendStatus, setBackendStatus] = useState<'loading' | 'connected' | 'error'>('loading');

    useEffect(() => {
        const fetchBackendVersion = async () => {
            try {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://pakyouth-heavy-backend.hf.space';
                const response = await fetch(backendUrl, { method: 'GET' });
                if (response.ok) {
                    const text = await response.text();
                    // Extract version from response like "Heavy Backend V5.0 (Multi-Provider LLM) Online 🚀"
                    const match = text.match(/V[\d.]+\s*\([^)]+\)/);
                    setBackendVersion(match ? match[0] : text);
                    setBackendStatus('connected');
                } else {
                    setBackendVersion('Unreachable');
                    setBackendStatus('error');
                }
            } catch (error) {
                console.error('Failed to fetch backend version:', error);
                setBackendVersion('Connection Failed');
                setBackendStatus('error');
            }
        };
        fetchBackendVersion();
    }, []);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            router.push('/login');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <main className="min-h-screen bg-black text-white p-6 font-sans">
            {/* Header */}
            <header className="flex items-center gap-4 mb-8">
                <Link href="/dashboard" className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-xl font-bold uppercase tracking-wider">Settings</h1>
            </header>

            <div className="max-w-md mx-auto space-y-8">
                {/* Profile Section */}
                <section className="space-y-4">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Profile</h2>
                    <div className="bg-gray-900/50 border border-white/10 rounded-lg p-4 flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Signed in as</p>
                            <p className="font-bold text-white">{user?.email}</p>
                        </div>
                    </div>
                </section>

                {/* Account Actions */}
                <section className="space-y-4">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Account</h2>

                    <div className="space-y-1">
                        <button className="w-full flex items-center justify-between p-4 bg-gray-900/30 hover:bg-gray-900/60 border border-white/5 rounded-lg transition-colors group">
                            <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5 text-gray-400 group-hover:text-white" />
                                <span className="text-sm font-medium text-gray-300 group-hover:text-white">Change Password</span>
                            </div>
                            <span className="text-xs text-gray-600">Coming Soon</span>
                        </button>
                    </div>
                </section>

                {/* Developer Settings */}
                <DeveloperSettingsSection />

                {/* App Info */}
                <section className="space-y-4">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">About</h2>
                    <div className="bg-gray-900/30 border border-white/5 rounded-lg p-4 space-y-4">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-primary mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Weekly Research Agent</h3>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    An advanced AI-powered intelligence platform designed for Pak Youth For Gaza.
                                    Automates news discovery, video verification, and strategic reporting.
                                </p>
                            </div>
                        </div>

                        {/* Backend Connection Status */}
                        <div className="pt-4 border-t border-white/5 space-y-2">
                            <div className="flex items-center gap-2">
                                {backendStatus === 'connected' ? (
                                    <Server className="w-4 h-4 text-green-500" />
                                ) : backendStatus === 'error' ? (
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                ) : (
                                    <Server className="w-4 h-4 text-yellow-500 animate-pulse" />
                                )}
                                <span className="text-xs text-gray-400">Backend:</span>
                                <span className={`text-xs font-mono ${backendStatus === 'connected' ? 'text-green-400' :
                                        backendStatus === 'error' ? 'text-red-400' : 'text-yellow-400'
                                    }`}>
                                    {backendVersion}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Frontend v1.0.0</span>
                                <span>Build 2025.12.16</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full py-4 mt-8 flex items-center justify-center gap-2 text-red-500 hover:text-red-400 hover:bg-red-900/10 border border-red-900/30 rounded-lg transition-all font-bold uppercase tracking-widest text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    Log Out
                </button>
            </div>
        </main>
    );
}

function DeveloperSettingsSection() {
    const { isDevMode, enableDevMode, disableDevMode } = useDeveloper();

    return (
        <section className="space-y-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Developer</h2>
            <div className="bg-gray-900/30 border border-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <Terminal className={`w-5 h-5 ${isDevMode ? 'text-green-500' : 'text-gray-400'}`} />
                        <div>
                            <h3 className="text-sm font-bold text-white">Developer Mode</h3>
                            <p className="text-xs text-gray-400">Enable advanced logs and debugging tools.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => isDevMode ? disableDevMode() : enableDevMode()}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black ${isDevMode ? 'bg-green-500' : 'bg-gray-700'
                            }`}
                    >
                        <span
                            className={`${isDevMode ? 'translate-x-6' : 'translate-x-1'
                                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                    </button>
                </div>
                {isDevMode && (
                    <div className="mt-3 p-3 bg-green-900/10 border border-green-500/20 rounded text-[10px] text-green-400 font-mono">
                        Active. Console available via floating icon.
                    </div>
                )}
            </div>
        </section>
    );
}
