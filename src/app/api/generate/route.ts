import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateAI, PlanLimitError, AIServiceError, ValidationError } from '@/lib/ai/generate'
import type { PromptKey } from '@/lib/ai/generate'

// ─── In-process rate limiter (30 req/min per user) ───────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
    const now = Date.now()
    const entry = rateLimitMap.get(userId)
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 })
        return true
    }
    if (entry.count >= 30) return false
    entry.count++
    return true
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
    // Auth check
    const supabase = await createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Rate limit
    if (!checkRateLimit(userId)) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please wait a moment before generating again.' },
            { status: 429 }
        )
    }

    // Parse body
    let body: Record<string, unknown>
    try {
        body = (await req.json()) as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const promptKey = body.type as PromptKey | undefined
    if (!promptKey) {
        return NextResponse.json({ error: 'Missing required field: type' }, { status: 400 })
    }

    // Delegate everything (plan checks, voice, quota, logging) to generateAI
    try {
        const result = await generateAI({
            userId,
            promptKey,
            input: body,
            useVoice: body.useVoice === true,
            clientId: typeof body.clientId === 'string' ? body.clientId : undefined,
        })

        return NextResponse.json({ content: result.content })
    } catch (err) {
        if (err instanceof PlanLimitError) {
            return NextResponse.json(
                { error: err.message, code: err.code, postsUsed: err.postsUsed, limit: err.limit },
                { status: 403 }
            )
        }
        if (err instanceof ValidationError) {
            return NextResponse.json(
                { error: err.message, code: err.code },
                { status: 400 }
            )
        }
        if (err instanceof AIServiceError) {
            return NextResponse.json(
                { error: err.message, code: err.code },
                { status: 502 }
            )
        }
        // Unknown — never expose internals
        return NextResponse.json(
            { error: 'An unexpected error occurred. Please try again.' },
            { status: 500 }
        )
    }
}
