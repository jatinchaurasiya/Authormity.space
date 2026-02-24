'use client'

import { useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
    // Removed client-side supabase auth per user instructions. Direct OAuth anchor navigation logic relies on /api/auth/linkedin

    return (
        <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
            {/* Background glow */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
                <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-[100px]" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Card */}
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
                    {/* Logo */}
                    <div className="mb-8 text-center">
                        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                            <span className="text-xl font-bold text-white">A</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            Welcome to Authormity
                        </h1>
                        <p className="mt-2 text-sm text-white/50">
                            Your LinkedIn content OS. Sign in to get started.
                        </p>
                    </div>

                    {/* LinkedIn Button */}
                    <a
                        id="linkedin-login-btn"
                        href="/api/auth/linkedin"
                        className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-[#0A66C2] px-6 py-4 text-[15px] font-semibold text-white shadow-lg transition-all duration-200 hover:bg-[#004182] hover:shadow-blue-500/30 hover:shadow-xl active:scale-[0.98]"
                    >
                        {/* LinkedIn icon */}
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                        <span>Continue with LinkedIn</span>
                    </a>

                    {/* Divider */}
                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="text-xs text-white/30">secure OAuth 2.0</span>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5">
                        {[
                            'AI-powered LinkedIn post generator',
                            'Personalized voice profile',
                            'Content scheduling & analytics',
                        ].map((f) => (
                            <li key={f} className="flex items-center gap-2.5 text-sm text-white/60">
                                <svg className="h-4 w-4 shrink-0 text-blue-400" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm3.78 5.22a.75.75 0 00-1.06 0L7 8.94 5.28 7.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25a.75.75 0 000-1.06z" />
                                </svg>
                                {f}
                            </li>
                        ))}
                    </ul>

                    {/* Terms */}
                    <p className="mt-6 text-center text-[11px] text-white/25 leading-relaxed">
                        By continuing, you agree to our{' '}
                        <a href="/terms" className="underline underline-offset-2 hover:text-white/50 transition-colors">
                            Terms
                        </a>{' '}
                        and{' '}
                        <a href="/privacy" className="underline underline-offset-2 hover:text-white/50 transition-colors">
                            Privacy Policy
                        </a>
                        .
                    </p>
                </div>

                {/* Bottom tagline */}
                <p className="mt-6 text-center text-xs text-white/25">
                    authormity.space — built for LinkedIn creators
                </p>
            </div>
        </main>
    )
}
