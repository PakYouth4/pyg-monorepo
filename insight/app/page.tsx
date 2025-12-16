"use client";

import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Globe, Zap, FileText, Shield, Twitter, Instagram, Mail, UserPlus } from 'lucide-react';

export default function LandingPage() {
  const { scrollY } = useScroll();
  const navBackground = useTransform(scrollY, [0, 100], ["rgba(0,0,0,0)", "rgba(0,0,0,0.8)"]);
  const navBackdropBlur = useTransform(scrollY, [0, 100], ["blur(0px)", "blur(12px)"]);
  const logoScale = useTransform(scrollY, [0, 100], [1, 0.9]);

  return (
    <main className="min-h-screen bg-black text-white font-sans selection:bg-primary selection:text-black relative overflow-x-hidden">

      {/* 1. ANIMATED BACKGROUND ELEMENTS (Category 3) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-black">
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.2]"
          style={{
            backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: 'center' // Fix alignment
          }}>
        </div>

        {/* Radial Gradient for Focus */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black pointer-events-none" />
      </div>

      {/* 2. NAVBAR (Category 6) */}
      <motion.nav
        style={{ backgroundColor: navBackground, backdropFilter: navBackdropBlur }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 transition-colors duration-300"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-center md:justify-between items-center">
          {/* Logo + Brand */}
          <motion.div style={{ scale: logoScale }} className="flex items-center gap-3 md:gap-4">
            <div className="relative w-[40px] h-[40px] md:w-[60px] md:h-[60px]">
              <Image src="/flag-icon.png" alt="PYG Logo" fill className="object-contain" />
            </div>
            <div className="flex flex-col justify-center text-left">
              <span className="text-base md:text-xl font-heading font-bold tracking-tight text-white leading-none">
                PAK YOUTH FOR GAZA
              </span>
              <span className="text-[9px] md:text-[10px] font-mono text-gray-500 tracking-widest uppercase mt-1">
                Voicing for the voiceless
              </span>
            </div>
          </motion.div>

          {/* Desktop Only: Socials or minimal links could go here if needed, but keeping it clean as requested */}
        </div>
      </motion.nav>

      {/* 3. HERO SECTION (Category 3, 4, 5) */}
      <section className="relative z-10 min-h-[calc(100vh-80px)] flex flex-col justify-center items-center px-6 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-center w-full max-w-7xl mx-auto flex flex-col items-center"
        >
          {/* Main Title Image */}
          <div className="relative w-full max-w-5xl h-[200px] md:h-[350px] mb-12">
            <Image
              src="/insight-logo-final.jpg"
              alt="Insight - By Pak Youth For Gaza"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Primary Actions (Login / Sign Up) */}
          <div className="flex flex-col gap-6 w-full max-w-xs md:max-w-md mb-12">
            <Link href="/login" className="w-full group relative px-8 py-4 bg-primary text-white font-bold uppercase tracking-widest text-sm overflow-hidden text-center shadow-[0_0_20px_rgba(220,38,38,0.3)]">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <div className="relative flex items-center justify-center gap-3">
                <Shield className="w-5 h-5" />
                LOGIN
              </div>
            </Link>

            <Link href="/signup" className="w-full group px-8 py-4 border border-white/20 text-white font-bold uppercase tracking-widest text-sm hover:bg-white hover:text-black transition-all duration-300 text-center">
              <div className="flex items-center justify-center gap-3">
                <UserPlus className="w-5 h-5" />
                CREATE ACCOUNT
              </div>
            </Link>
          </div>

          {/* Secondary Links (Mission / How it Works) */}
          <div className="flex flex-col md:flex-row gap-6 md:gap-12 text-xs md:text-sm font-mono text-gray-500 uppercase tracking-widest">
            <Link href="#mission" className="hover:text-primary transition-colors border-b border-transparent hover:border-primary pb-1">
              Our Mission
            </Link>
            <Link href="#features" className="hover:text-primary transition-colors border-b border-transparent hover:border-primary pb-1">
              How it Works
            </Link>
          </div>

          {/* Scroll Indicator (Desktop Only) */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-50 hidden md:block"
          >
            <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center p-1">
              <div className="w-1 h-2 bg-white rounded-full" />
            </div>
          </motion.div>

        </motion.div>
      </section>

      {/* 4. FEATURES SECTION (Category 8) */}
      <section id="features" className="relative z-10 py-32 px-6 bg-black/50 backdrop-blur-sm border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

            {/* Column 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="group p-8 border border-white/5 hover:border-primary/50 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-500"
            >
              <Globe className="w-10 h-10 text-primary mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-heading font-bold mb-4">Real-Time Monitoring</h3>
              <ul className="space-y-3 text-gray-400 font-light">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full" /> Live news feed</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full" /> Instant updates</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full" /> Crisis alerts</li>
              </ul>
            </motion.div>

            {/* Column 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="group p-8 border border-white/5 hover:border-primary/50 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-500"
            >
              <Zap className="w-10 h-10 text-primary mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-heading font-bold mb-4">Trend Analysis</h3>
              <ul className="space-y-3 text-gray-400 font-light">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full" /> Predictive analytics</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full" /> AI modeling</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full" /> Verified sources</li>
              </ul>
            </motion.div>

            {/* Column 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="group p-8 border border-white/5 hover:border-primary/50 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-500"
            >
              <FileText className="w-10 h-10 text-primary mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-heading font-bold mb-4">Strategic Briefings</h3>
              <ul className="space-y-3 text-gray-400 font-light">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full" /> Daily intelligence papers</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full" /> For youth activism teams</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full" /> Easy to share</li>
              </ul>
            </motion.div>

          </div>
        </div>
      </section>

      {/* 5. FOOTER (Category 12) */}
      <footer className="relative z-10 py-12 border-t border-white/10 bg-black">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start">
            <span className="text-lg font-heading font-bold text-white">PAK YOUTH FOR GAZA</span>
            <span className="text-xs text-gray-500 font-mono mt-1">Powered by INSIGHT Engine v1.0</span>
          </div>

          <div className="flex gap-8 text-sm text-gray-400">
            <a href="#" className="hover:text-primary transition-colors">Mission</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Contact</a>
          </div>

          <div className="flex gap-4">
            <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all">
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
