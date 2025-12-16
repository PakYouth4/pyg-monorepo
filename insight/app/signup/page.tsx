"use client";

import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Shield, Mail, Lock, Loader2, User, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SignUpPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Check auth state - redirect to dashboard if already logged in
    const { loading: authLoading } = useAuth(false, true);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            router.push('/dashboard');
        } catch (err: unknown) {
            console.error("Login failed:", err);
            setError((err as Error).message);
            setLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            if (name) {
                await updateProfile(userCredential.user, { displayName: name });
            }
            router.push('/dashboard');
        } catch (err: unknown) {
            console.error("Auth failed:", err);
            setError((err as Error).message.replace('Firebase: ', ''));
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden font-sans">

            {/* Background Elements */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.15]"
                    style={{
                        backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)`,
                        backgroundSize: '50px 50px'
                    }}>
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black pointer-events-none" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-md w-full relative z-10"
            >

                {/* Logo & Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative w-full max-w-[300px] h-[100px] mb-4">
                        <Image
                            src="/insight-logo-final.jpg"
                            alt="Insight Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight">
                        CREATE ACCOUNT
                    </h1>
                </div>

                {/* Sign Up Card */}
                <div className="border border-white/10 p-8 rounded-lg bg-black/50 backdrop-blur-xl shadow-2xl shadow-black/50">

                    {error && (
                        <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-3 text-sm mb-6 rounded flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Sign Up Form */}
                    <form onSubmit={handleSignUp} className="space-y-4 mb-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white uppercase tracking-wider">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded p-3 pl-10 text-white focus:outline-none focus:border-primary transition-colors"
                                    placeholder="Full Name"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white uppercase tracking-wider">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded p-3 pl-10 text-white focus:outline-none focus:border-primary transition-colors"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded p-3 pl-10 pr-10 text-white focus:outline-none focus:border-primary transition-colors"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white font-bold py-3 px-4 rounded hover:bg-red-700 transition-colors uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign Up"}
                        </button>
                    </form>

                    <div className="text-center mb-6">
                        <Link
                            href="/login"
                            className="text-xs text-gray-400 hover:text-white transition-colors uppercase tracking-widest"
                        >
                            Already have an account? Login
                        </Link>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-px bg-white/20 flex-1" />
                        <span className="text-xs text-white uppercase font-bold tracking-widest">Or continue with</span>
                        <div className="h-px bg-white/20 flex-1" />
                    </div>

                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full bg-white text-black font-bold py-3 px-4 rounded hover:bg-gray-200 transition-colors uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Sign in with Google
                    </button>
                </div>

                <div className="text-center mt-8">
                    <Link href="/" className="text-gray-500 hover:text-white text-sm flex items-center justify-center gap-2 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                </div>
            </motion.div>
        </main>
    );
}
