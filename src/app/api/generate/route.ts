import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { callAI } from '@/lib/openrouter'
import { SYSTEM_PROMPT, PROMPTS, buildVoiceContext } from '@/lib/prompts'
import { checkCanGenerate, resetMonthlyCounterIfNeeded, incrementPostsUsed } from '@/lib/plans'
import { createAdminClient } from '@/lib/supabase-server'
import type { GenerateRequest, VoiceProfile } from '@/types'

// Rate limit: 30 requests per minute per user
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

export async function POST(req: NextRequest) {
    const supabase = await createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Rate limit check
    if (!checkRateLimit(userId)) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please wait before generating more content.' },
            { status: 429 }
        )
    }

    // Reset monthly counter if needed
    await resetMonthlyCounterIfNeeded(userId)

    const body: GenerateRequest = await req.json()
    const { type } = body

    // Validate required fields
    if (!type) {
        return NextResponse.json({ error: 'Missing type' }, { status: 400 })
    }

    // Check generation limit (skip for voice analysis which is setup, not generation)
    if (type !== 'analyzeVoice') {
        const { allowed, reason } = await checkCanGenerate(userId)
        if (!allowed) {
            return NextResponse.json({ error: reason, code: 'LIMIT_REACHED' }, { status: 403 })
        }
    }

    try {
        const adminSupabase = createAdminClient()
        let voiceProfile: VoiceProfile | null = null

        // Load voice profile if requested
        if (body.useVoice) {
            const clientId = body.clientId
            if (clientId) {
                // Load client's voice profile
                const { data: client } = await adminSupabase
                    .from('clients')
                    .select('voice_profile_id')
                    .eq('id', clientId)
                    .eq('user_id', userId)
                    .single()

                if (client?.voice_profile_id) {
                    const { data } = await adminSupabase
                        .from('voice_profiles')
                        .select('*')
                        .eq('id', client.voice_profile_id)
                        .single()
                    voiceProfile = data
                }
            } else {
                const { data } = await adminSupabase
                    .from('voice_profiles')
                    .select('*')
                    .eq('user_id', userId)
                    .single()
                voiceProfile = data
            }
        }

        const voiceContext = voiceProfile ? buildVoiceContext(voiceProfile) : undefined

        // Build the prompt
        let prompt: string
        let temperature = 0.8
        let maxTokens = 1000

        switch (type) {
            case 'post':
                prompt = PROMPTS.post(
                    body.topic || '',
                    body.tone || 'conversational',
                    body.length || 'medium',
                    voiceContext
                )
                break

            case 'hooks':
                prompt = PROMPTS.hooks(body.topic || '', voiceContext)
                temperature = 0.9
                maxTokens = 600
                break

            case 'ideas':
                prompt = PROMPTS.ideas(body.topic || 'Professional', voiceContext)
                temperature = 0.85
                maxTokens = 1200
                break

            case 'repurpose':
                prompt = PROMPTS.repurpose(
                    body.sourceType || 'content',
                    body.sourceContent || '',
                    voiceContext
                )
                break

            case 'rateHook':
                prompt = PROMPTS.rateHook(body.hookText || '')
                temperature = 0.3
                maxTokens = 400
                break

            case 'analyzeVoice':
                prompt = PROMPTS.analyzeVoice(body.samplePosts || [])
                temperature = 0.2
                maxTokens = 800
                break

            case 'comment':
                prompt = PROMPTS.comment(
                    body.postText || '',
                    body.commentIntent || 'add-value',
                    voiceContext
                )
                maxTokens = 500
                break

            case 'humanize':
                prompt = PROMPTS.humanize(body.topic || '', voiceContext)
                temperature = 0.9
                maxTokens = 1200
                break

            case 'carousel':
                prompt = PROMPTS.carousel(body.topic || '', body.slideCount || 8, voiceContext)
                temperature = 0.75
                maxTokens = 1500
                break

            case 'thread':
                prompt = PROMPTS.thread(body.topic || '', body.threadCount || 5, voiceContext)
                maxTokens = 2000
                break

            case 'connectionMessage':
                prompt = PROMPTS.connectionMessage(
                    body.personRole || 'Professional',
                    body.topic || '',
                    'LinkedIn Creator'
                )
                temperature = 0.7
                maxTokens = 200
                break

            case 'weeklyInsights':
                prompt = PROMPTS.weeklyInsights(body.topic || '')
                temperature = 0.4
                maxTokens = 600
                break

            default:
                return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
        }

        const content = await callAI({
            prompt,
            systemPrompt: SYSTEM_PROMPT,
            temperature,
            maxTokens,
        })

        // Increment usage counter (skip voice analysis)
        if (type !== 'analyzeVoice') {
            await incrementPostsUsed(userId)
        }

        // Log usage
        await adminSupabase.from('usage_logs').insert({
            user_id: userId,
            action: type,
            model_used: process.env.OPENROUTER_MODEL || 'arcee-ai/arcee-trinity',
        })

        return NextResponse.json({ content })
    } catch (err) {
        console.error('Generation error:', err)
        return NextResponse.json(
            { error: 'Generation failed. Please try again.' },
            { status: 500 }
        )
    }
}
