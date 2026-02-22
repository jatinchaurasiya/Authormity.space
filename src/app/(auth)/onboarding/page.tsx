'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Data ──────────────────────────────────────────────────────────────────

const WORK_STREAMS = [
    { id: 'founder', emoji: '🚀', label: 'Founder / CEO' },
    { id: 'marketer', emoji: '📣', label: 'Marketer' },
    { id: 'sales', emoji: '💼', label: 'Sales Professional' },
    { id: 'coach', emoji: '🎯', label: 'Coach / Consultant' },
    { id: 'recruiter', emoji: '🤝', label: 'Recruiter / HR' },
    { id: 'engineer', emoji: '⚙️', label: 'Engineer / Developer' },
    { id: 'designer', emoji: '🎨', label: 'Designer / Creative' },
    { id: 'freelancer', emoji: '🧩', label: 'Freelancer' },
    { id: 'creator', emoji: '✍️', label: 'Content Creator' },
    { id: 'executive', emoji: '👔', label: 'Executive / Leader' },
    { id: 'investor', emoji: '📈', label: 'Investor / VC' },
    { id: 'student', emoji: '🎓', label: 'Student / Fresher' },
    { id: 'other', emoji: '✏️', label: 'Other (write your own)' },
]

const LINKEDIN_TIME = [
    { id: 'lt30', label: 'Less than 30 min / week', sub: 'Just lurking' },
    { id: '30_60', label: '30–60 min / week', sub: 'Occasional scroll' },
    { id: '1_3h', label: '1–3 hrs / week', sub: 'Somewhat active' },
    { id: '3_7h', label: '3–7 hrs / week', sub: 'Regularly posting' },
    { id: '7h_plus', label: '7+ hrs / week', sub: 'LinkedIn is my job' },
]

const GOALS = [
    { id: 'followers', emoji: '📈', label: 'Grow my follower count' },
    { id: 'leads', emoji: '💰', label: 'Generate leads & sales pipeline' },
    { id: 'authority', emoji: '🏆', label: 'Build thought leadership' },
    { id: 'speaking', emoji: '🎤', label: 'Get speaking / media opportunities' },
    { id: 'job', emoji: '💼', label: 'Land a new job or clients' },
    { id: 'consistent', emoji: '🗓️', label: 'Stop procrastinating & stay consistent' },
    { id: 'company', emoji: '🏢', label: 'Help my team / company get visibility' },
    { id: 'brand', emoji: '⭐', label: 'Build a personal brand alongside my 9–5' },
]

// ─── Types ─────────────────────────────────────────────────────────────────

interface FormData {
    workStream: string
    customWorkStream: string
    linkedinTime: string
    targetAudience: string
    goals: string[]
}

// ─── Reusable components ───────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex items-center gap-2 mb-8">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < current ? 'bg-blue-500' : 'bg-white/10'
                        }`}
                />
            ))}
            <span className="ml-2 text-xs text-white/40 shrink-0">
                {current} / {total}
            </span>
        </div>
    )
}

// ─── Steps ─────────────────────────────────────────────────────────────────

function Step1({
    value,
    custom,
    onChange,
    onCustomChange,
}: {
    value: string
    custom: string
    onChange: (v: string) => void
    onCustomChange: (v: string) => void
}) {
    return (
        <div>
            <h2 className="text-xl font-bold text-white mb-1">What best describes your work?</h2>
            <p className="text-sm text-white/45 mb-6">Pick the stream that fits you most — or write your own.</p>

            <div className="grid grid-cols-2 gap-2">
                {WORK_STREAMS.map((ws) => (
                    <button
                        key={ws.id}
                        type="button"
                        onClick={() => onChange(ws.id)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-medium transition-all duration-150 ${value === ws.id
                                ? 'border-blue-500 bg-blue-500/15 text-white'
                                : 'border-white/8 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
                            }`}
                    >
                        <span className="text-lg leading-none">{ws.emoji}</span>
                        <span className="leading-tight">{ws.label}</span>
                    </button>
                ))}
            </div>

            {value === 'other' && (
                <input
                    type="text"
                    value={custom}
                    onChange={(e) => onCustomChange(e.target.value)}
                    placeholder="Describe your work stream…"
                    className="mt-3 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500 transition-colors"
                />
            )}
        </div>
    )
}

function Step2({
    value,
    onChange,
}: {
    value: string
    onChange: (v: string) => void
}) {
    return (
        <div>
            <h2 className="text-xl font-bold text-white mb-1">How much time do you spend on LinkedIn?</h2>
            <p className="text-sm text-white/45 mb-6">We&apos;ll personalise your content plan accordingly.</p>

            <div className="flex flex-col gap-2.5">
                {LINKEDIN_TIME.map((opt) => (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange(opt.id)}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all duration-150 ${value === opt.id
                                ? 'border-blue-500 bg-blue-500/15'
                                : 'border-white/8 bg-white/5 hover:border-white/20'
                            }`}
                    >
                        <div>
                            <p className={`text-sm font-semibold ${value === opt.id ? 'text-white' : 'text-white/70'}`}>
                                {opt.label}
                            </p>
                            <p className="text-xs text-white/35 mt-0.5">{opt.sub}</p>
                        </div>
                        {value === opt.id && (
                            <div className="h-5 w-5 shrink-0 rounded-full bg-blue-500 flex items-center justify-center">
                                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}

function Step3({
    value,
    onChange,
}: {
    value: string
    onChange: (v: string) => void
}) {
    return (
        <div>
            <h2 className="text-xl font-bold text-white mb-1">Who do you want to reach?</h2>
            <p className="text-sm text-white/45 mb-6">
                Describe your ideal audience — the more specific, the better your content will be.
            </p>

            <textarea
                id="target-audience"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="e.g. B2B SaaS founders, startup marketers, senior recruiters at tech companies…"
                rows={4}
                className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3.5 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500 transition-colors resize-none"
            />

            <div className="mt-3 flex flex-wrap gap-2">
                {[
                    'B2B founders',
                    'Startup marketers',
                    'Enterprise sales reps',
                    'Recruiters',
                    'Career switchers',
                    'Early-stage startups',
                ].map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => onChange(value ? `${value}, ${s}` : s)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 hover:text-white hover:border-white/20 transition-colors"
                    >
                        + {s}
                    </button>
                ))}
            </div>
        </div>
    )
}

function Step4({
    values,
    onChange,
}: {
    values: string[]
    onChange: (v: string[]) => void
}) {
    function toggle(id: string) {
        onChange(
            values.includes(id) ? values.filter((g) => g !== id) : [...values, id]
        )
    }

    return (
        <div>
            <h2 className="text-xl font-bold text-white mb-1">What&apos;s your main goal on LinkedIn?</h2>
            <p className="text-sm text-white/45 mb-6">Pick all that apply — we&apos;ll weight the top ones.</p>

            <div className="grid grid-cols-1 gap-2.5">
                {GOALS.map((goal) => {
                    const selected = values.includes(goal.id)
                    return (
                        <button
                            key={goal.id}
                            type="button"
                            onClick={() => toggle(goal.id)}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150 ${selected
                                    ? 'border-blue-500 bg-blue-500/15'
                                    : 'border-white/8 bg-white/5 hover:border-white/20'
                                }`}
                        >
                            <span className="text-xl leading-none">{goal.emoji}</span>
                            <span className={`text-sm font-medium ${selected ? 'text-white' : 'text-white/65'}`}>
                                {goal.label}
                            </span>
                            <div className={`ml-auto h-5 w-5 shrink-0 rounded border transition-all ${selected
                                    ? 'border-blue-500 bg-blue-500'
                                    : 'border-white/20'
                                } flex items-center justify-center`}>
                                {selected && (
                                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Main Wizard ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const TOTAL = 4

    const [form, setForm] = useState<FormData>({
        workStream: '',
        customWorkStream: '',
        linkedinTime: '',
        targetAudience: '',
        goals: [],
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ── Validation per step ──────────────────────────────────────────────
    function canAdvance() {
        switch (step) {
            case 1:
                if (form.workStream === 'other') return form.customWorkStream.trim().length > 2
                return !!form.workStream
            case 2:
                return !!form.linkedinTime
            case 3:
                return form.targetAudience.trim().length > 3
            case 4:
                return form.goals.length > 0
            default:
                return false
        }
    }

    // ── Submit ───────────────────────────────────────────────────────────
    async function handleSubmit() {
        setLoading(true)
        setError(null)

        try {
            const niche =
                form.workStream === 'other'
                    ? form.customWorkStream.trim()
                    : WORK_STREAMS.find((w) => w.id === form.workStream)?.label ?? form.workStream

            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    niche,
                    linkedin_time: form.linkedinTime,
                    target_audience: form.targetAudience.trim(),
                    goals: form.goals,
                }),
            })

            if (!res.ok) {
                const data = (await res.json()) as { error?: string }
                throw new Error(data.error ?? 'Something went wrong')
            }

            router.push('/dashboard')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
            setLoading(false)
        }
    }

    function nextStep() {
        if (step < TOTAL) setStep((s) => s + 1)
        else handleSubmit()
    }

    function prevStep() {
        if (step > 1) setStep((s) => s - 1)
    }

    return (
        <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-12">
            {/* Background glow */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-blue-600/8 blur-[140px]" />
            </div>

            <div className="relative w-full max-w-lg">
                {/* Card */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 shadow-2xl">
                    {/* Logo + heading */}
                    <div className="mb-6 flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">A</span>
                        </div>
                        <span className="text-sm font-semibold text-white/60">Authormity</span>
                    </div>

                    <StepIndicator current={step} total={TOTAL} />

                    {/* Step content */}
                    <div className="min-h-[320px]">
                        {step === 1 && (
                            <Step1
                                value={form.workStream}
                                custom={form.customWorkStream}
                                onChange={(v) => setForm((f) => ({ ...f, workStream: v }))}
                                onCustomChange={(v) => setForm((f) => ({ ...f, customWorkStream: v }))}
                            />
                        )}
                        {step === 2 && (
                            <Step2
                                value={form.linkedinTime}
                                onChange={(v) => setForm((f) => ({ ...f, linkedinTime: v }))}
                            />
                        )}
                        {step === 3 && (
                            <Step3
                                value={form.targetAudience}
                                onChange={(v) => setForm((f) => ({ ...f, targetAudience: v }))}
                            />
                        )}
                        {step === 4 && (
                            <Step4
                                values={form.goals}
                                onChange={(v) => setForm((f) => ({ ...f, goals: v }))}
                            />
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            {error}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="mt-6 flex items-center gap-3">
                        {step > 1 && (
                            <button
                                type="button"
                                onClick={prevStep}
                                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-white/60 hover:text-white hover:border-white/20 transition-all"
                            >
                                Back
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={nextStep}
                            disabled={!canAdvance() || loading}
                            className="flex-1 flex items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Setting up your workspace…
                                </>
                            ) : step === TOTAL ? (
                                'Finish & Launch →'
                            ) : (
                                'Continue →'
                            )}
                        </button>
                    </div>

                    {/* Skip */}
                    {step < TOTAL && (
                        <p className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={() => setStep((s) => s + 1)}
                                className="text-xs text-white/25 hover:text-white/45 transition-colors"
                            >
                                Skip this step
                            </button>
                        </p>
                    )}
                </div>

                <p className="mt-5 text-center text-xs text-white/20">
                    You can change these settings anytime in your profile.
                </p>
            </div>
        </main>
    )
}
