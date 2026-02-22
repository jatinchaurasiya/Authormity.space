import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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
        const supabase = await createServerSupabaseClient()
        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body: unknown = await req.json()

        if (!isOnboardingBody(body)) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            )
        }

        const { niche, linkedin_time, target_audience, goals } = body

        if (!niche.trim()) {
            return NextResponse.json({ error: 'Work stream is required' }, { status: 400 })
        }

        const { error } = await supabase
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

        // Log goals + linkedin_time to usage_logs as metadata (non-critical)
        void (async () => {
            try {
                await supabase.from('usage_logs').insert({
                    user_id: session.user.id,
                    action: 'onboarding_complete' as string,
                    model_used: 'none',
                    tokens_used: 0,
                })
            } catch { /* swallow */ }
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
