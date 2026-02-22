import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

interface OnboardingBody {
    niche: string
    linkedin_time: string
    target_audience: string
    goals: string[]
}

function isOnboardingBody(val: unknown): val is OnboardingBody {
    if (!val || typeof val !== 'object') return false
    const b = val as Record<string, unknown>
    return (
        typeof b.niche === 'string' &&
        typeof b.linkedin_time === 'string' &&
        typeof b.target_audience === 'string' &&
        Array.isArray(b.goals)
    )
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        // ── Auth client (typed) to get the session ────────────────────────
        const cookieStore = await cookies()

        const authClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) { return cookieStore.get(name)?.value },
                    set(name: string, value: string, options: CookieOptions) {
                        try { cookieStore.set({ name, value, ...options }) } catch { /* server component */ }
                    },
                    remove(name: string, options: CookieOptions) {
                        try { cookieStore.set({ name, value: '', ...options }) } catch { /* server component */ }
                    },
                },
            }
        )

        const { data: { session } } = await authClient.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // ── Validate body ─────────────────────────────────────────────────
        const body: unknown = await req.json()

        if (!isOnboardingBody(body)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { niche, linkedin_time, target_audience, goals } = body

        if (!niche.trim()) {
            return NextResponse.json({ error: 'Work stream is required' }, { status: 400 })
        }

        // ── Admin client (untyped by design) to write data ────────────────
        // Using createClient directly avoids Postgrest v12 generic inference
        // issues with hand-written Database types.
        const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { error } = await admin
            .from('profiles')
            .update({
                niche: niche.trim(),
                target_audience: target_audience.trim() || null,
                onboarding_completed: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', session.user.id)

        if (error) {
            console.error('[onboarding] profile update error:', error)
            return NextResponse.json(
                { error: 'Failed to save your preferences. Please try again.' },
                { status: 500 }
            )
        }

        // ── Fire-and-forget usage log ─────────────────────────────────────
        void (async () => {
            try {
                await admin.from('usage_logs').insert({
                    user_id: session.user.id,
                    action: 'onboarding_complete',
                    model_used: 'none',
                    tokens_used: 0,
                })
            } catch { /* swallow — non-critical */ }
        })()

        return NextResponse.json({
            success: true,
            data: { niche, linkedin_time, target_audience, goals },
        })
    } catch (err) {
        console.error('[onboarding] unexpected error:', err)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }
}
