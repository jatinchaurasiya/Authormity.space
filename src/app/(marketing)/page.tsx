'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function HomePage() {
    // Client-side 'isLoading' removed per user constraints (must be direct anchor navigation)

    return (
        <main className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Background glows */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[700px] rounded-full bg-blue-600/10 blur-[140px]" />
                <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-indigo-600/8 blur-[120px]" />
            </div>

            {/* ── Nav ─────────────────────────────────────────────── */}
            <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
                        <span className="text-sm font-bold text-white">A</span>
                    </div>
                    <span className="text-[15px] font-semibold tracking-tight text-white">Authormity</span>
                </div>

                <div className="flex items-center gap-3">
                    <a
                        href="/api/auth/linkedin"
                        className="rounded-lg px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
                    >
                        Sign in
                    </a>
                    <a
                        href="/api/auth/linkedin"
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                    >
                        Get started free
                    </a>
                </div>
            </nav>

            {/* ── Hero ─────────────────────────────────────────────── */}
            <section className="relative z-10 mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
                {/* Badge */}
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                    LinkedIn Content OS — now live
                </div>

                <h1 className="text-5xl font-bold tracking-tight leading-tight md:text-6xl">
                    Write like an expert.
                    <br />
                    <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Grow on LinkedIn.
                    </span>
                </h1>

                <p className="mx-auto mt-6 max-w-xl text-lg text-white/50 leading-relaxed">
                    AI-powered LinkedIn ghostwriter that sounds exactly like you.
                    Generate posts, carousels, threads, and hooks — in seconds.
                </p>

                {/* CTA buttons */}
                <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                    <a
                        id="hero-cta-btn"
                        href="/api/auth/linkedin"
                        className="group flex items-center gap-3 rounded-xl bg-[#0A66C2] px-8 py-4 text-[15px] font-semibold text-white shadow-lg transition-all hover:bg-[#004182] hover:shadow-blue-500/30 hover:shadow-xl active:scale-[0.98]"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                        Continue with LinkedIn — it&apos;s free
                    </a>

                    <a
                        href="/api/auth/linkedin"
                        className="rounded-xl border border-white/10 px-8 py-4 text-[15px] font-medium text-white/60 hover:border-white/20 hover:text-white transition-all"
                    >
                        Sign in
                    </a>
                </div>

                <p className="mt-4 text-xs text-white/25">No credit card required · Free plan includes 10 AI generations/month</p>

                {/* ── Feature pills ───────────────────────────────── */}
                <div className="mt-16 flex flex-wrap justify-center gap-3">
                    {[
                        '✍️ Post generator',
                        '🎯 Voice profile',
                        '📅 Content calendar',
                        '🧵 Thread writer',
                        '🎠 Carousel builder',
                        '📊 Analytics',
                        '🔁 Content repurposer',
                        '💬 Comment generator',
                    ].map((f) => (
                        <span
                            key={f}
                            className="rounded-full border border-white/8 bg-white/5 px-4 py-1.5 text-xs text-white/50"
                        >
                            {f}
                        </span>
                    ))}
                </div>
            </section>

            {/* ── Social proof ─────────────────────────────────────── */}
            <section className="relative z-10 border-t border-white/5 py-12 text-center">
                <p className="text-sm text-white/25">Trusted by LinkedIn creators building their audience</p>
                <div className="mt-6 flex justify-center gap-10">
                    {[['10+', 'Content types'], ['∞', 'Pro generations'], ['30s', 'Avg. generation time']].map(([stat, label]) => (
                        <div key={label} className="text-center">
                            <p className="text-2xl font-bold text-white">{stat}</p>
                            <p className="text-xs text-white/35 mt-1">{label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Footer ───────────────────────────────────────────── */}
            <footer className="relative z-10 border-t border-white/5 px-6 py-6 text-center text-xs text-white/20">
                © {new Date().getFullYear()} Authormity.space · {' '}
                <Link href="/privacy" className="hover:text-white/40 transition-colors">Privacy</Link>
                {' · '}
                <Link href="/terms" className="hover:text-white/40 transition-colors">Terms</Link>
            </footer>
        </main>
    )
}
