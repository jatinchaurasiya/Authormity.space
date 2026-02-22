import { createAdminClient } from '@/lib/supabase-server'
import { callAI } from '@/lib/openrouter'
import { SYSTEM_PROMPT, PROMPTS, buildVoiceContext } from '@/lib/prompts'
import { checkCanGenerate, resetMonthlyCounterIfNeeded, incrementPostsUsed } from '@/lib/plans'
import type { VoiceProfile } from '@/types'

// ─── Typed Errors ─────────────────────────────────────────────────────────────

export class PlanLimitError extends Error {
    readonly code = 'PLAN_LIMIT_REACHED' as const
    readonly postsUsed: number
    readonly limit: number

    constructor(message: string, postsUsed: number, limit: number) {
        super(message)
        this.name = 'PlanLimitError'
        this.postsUsed = postsUsed
        this.limit = limit
    }
}

export class AIServiceError extends Error {
    readonly code = 'AI_SERVICE_ERROR' as const
    constructor(message: string) {
        super(message)
        this.name = 'AIServiceError'
    }
}

export class ValidationError extends Error {
    readonly code = 'VALIDATION_ERROR' as const
    constructor(message: string) {
        super(message)
        this.name = 'ValidationError'
    }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PromptKey = keyof typeof PROMPTS

/** Prompt configs: per-key temperature and maxTokens. */
const PROMPT_CONFIG: Record<PromptKey, { temperature: number; maxTokens: number; consumesQuota: boolean }> = {
    post: { temperature: 0.80, maxTokens: 1000, consumesQuota: true },
    hooks: { temperature: 0.90, maxTokens: 600, consumesQuota: true },
    ideas: { temperature: 0.85, maxTokens: 1200, consumesQuota: true },
    repurpose: { temperature: 0.80, maxTokens: 1000, consumesQuota: true },
    rateHook: { temperature: 0.30, maxTokens: 400, consumesQuota: true },
    analyzeVoice: { temperature: 0.20, maxTokens: 800, consumesQuota: false },
    comment: { temperature: 0.80, maxTokens: 500, consumesQuota: true },
    humanize: { temperature: 0.90, maxTokens: 1200, consumesQuota: true },
    carousel: { temperature: 0.75, maxTokens: 1500, consumesQuota: true },
    thread: { temperature: 0.80, maxTokens: 2000, consumesQuota: true },
    connectionMessage: { temperature: 0.70, maxTokens: 200, consumesQuota: true },
    weeklyInsights: { temperature: 0.40, maxTokens: 600, consumesQuota: true },
}

const MAX_PROMPT_CHARS = 12_000

export interface GenerateAIInput {
    userId: string
    promptKey: PromptKey
    /** Raw input values for the selected prompt template. */
    input: Record<string, unknown>
    /** Whether to inject the user's voice profile. */
    useVoice?: boolean
    /** Client ID for ghostwriter mode — loads client's voice profile instead. */
    clientId?: string
}

export interface GenerateAIResult {
    content: string
    promptKey: PromptKey
    tokensUsed: number | null
}

// ─── Voice Profile Loader ─────────────────────────────────────────────────────

async function loadVoiceProfile(
    userId: string,
    clientId?: string
): Promise<VoiceProfile | null> {
    const supabase = createAdminClient()

    if (clientId) {
        const { data: client } = await supabase
            .from('clients')
            .select('voice_profile_id')
            .eq('id', clientId)
            .eq('user_id', userId)
            .maybeSingle()

        if (!client?.voice_profile_id) return null

        const { data } = await supabase
            .from('voice_profiles')
            .select('*')
            .eq('id', client.voice_profile_id)
            .maybeSingle()

        return data as VoiceProfile | null
    }

    const { data } = await supabase
        .from('voice_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

    return data as VoiceProfile | null
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildPrompt(
    key: PromptKey,
    input: Record<string, unknown>,
    voiceContext?: string
): string {
    const str = (k: string, fallback = '') =>
        typeof input[k] === 'string' ? (input[k] as string) : fallback

    const num = (k: string, fallback: number) =>
        typeof input[k] === 'number' ? (input[k] as number) : fallback

    const strArr = (k: string): string[] =>
        Array.isArray(input[k]) ? (input[k] as string[]) : []

    switch (key) {
        case 'post':
            return PROMPTS.post(str('topic'), str('tone', 'conversational'), str('length', 'medium'), voiceContext)
        case 'hooks':
            return PROMPTS.hooks(str('topic'), voiceContext)
        case 'ideas':
            return PROMPTS.ideas(str('niche', 'Professional'), voiceContext)
        case 'repurpose':
            return PROMPTS.repurpose(str('sourceType', 'content'), str('sourceContent'), voiceContext)
        case 'rateHook':
            return PROMPTS.rateHook(str('hookText'))
        case 'analyzeVoice':
            return PROMPTS.analyzeVoice(strArr('samplePosts'))
        case 'comment':
            return PROMPTS.comment(str('postText'), str('commentIntent', 'add-value'), voiceContext)
        case 'humanize':
            return PROMPTS.humanize(str('aiText'), voiceContext)
        case 'carousel':
            return PROMPTS.carousel(str('topic'), num('slideCount', 8), voiceContext)
        case 'thread':
            return PROMPTS.thread(str('topic'), num('threadCount', 5), voiceContext)
        case 'connectionMessage':
            return PROMPTS.connectionMessage(str('personRole', 'Professional'), str('context'), str('userNiche', 'LinkedIn Creator'))
        case 'weeklyInsights':
            return PROMPTS.weeklyInsights(str('analyticsData'))
        default: {
            const exhausted: never = key
            throw new ValidationError(`Unknown prompt key: ${String(exhausted)}`)
        }
    }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Centralized AI generation with plan enforcement, voice injection,
 * usage logging, and typed error surfacing.
 */
export async function generateAI({
    userId,
    promptKey,
    input,
    useVoice = false,
    clientId,
}: GenerateAIInput): Promise<GenerateAIResult> {
    if (!userId) throw new ValidationError('userId is required')
    if (!promptKey || !(promptKey in PROMPTS)) {
        throw new ValidationError(`Invalid promptKey: ${String(promptKey)}`)
    }

    const config = PROMPT_CONFIG[promptKey]
    const supabase = createAdminClient()

    // 1. Reset monthly counter if past reset date
    await resetMonthlyCounterIfNeeded(userId)

    // 2. Enforce plan limits (skip for non-quota calls like analyzeVoice)
    if (config.consumesQuota) {
        const { allowed, reason, postsUsed, limit } = await checkCanGenerate(userId)
        if (!allowed) {
            throw new PlanLimitError(reason ?? 'Monthly limit reached', postsUsed, limit)
        }
    }

    // 3. Load voice profile if requested
    let voiceContext: string | undefined
    if (useVoice) {
        const voice = await loadVoiceProfile(userId, clientId)
        if (voice) voiceContext = buildVoiceContext(voice)
    }

    // 4. Build prompt and guard token size
    const prompt = buildPrompt(promptKey, input, voiceContext)

    if (prompt.length > MAX_PROMPT_CHARS) {
        throw new ValidationError(
            `Prompt exceeds maximum allowed size (${prompt.length} / ${MAX_PROMPT_CHARS} chars). Reduce input size.`
        )
    }

    // 5. Call AI
    let rawContent: string
    let tokensUsed: number | null = null

    try {
        rawContent = await callAI({
            prompt,
            systemPrompt: SYSTEM_PROMPT,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
        })
    } catch (err) {
        // Sanitize — never expose internal details to caller
        throw new AIServiceError('AI generation failed. Please try again.')
    }

    // 6. Log usage (fire-and-forget; non-blocking)
    const model = process.env.OPENROUTER_MODEL ?? 'arcee-ai/trinity-large-preview:free'

    // Fire-and-forget: log usage, never fail generation over it
    void (async () => {
        try {
            await supabase.from('usage_logs').insert({
                user_id: userId,
                action: promptKey,
                model_used: model,
                tokens_used: tokensUsed,
            })
        } catch { /* swallow */ }
    })()

    // 7. Increment monthly quota (non-blocking)
    if (config.consumesQuota) {
        void (async () => {
            try { await incrementPostsUsed(userId) } catch { /* swallow */ }
        })()
    }

    return { content: rawContent, promptKey, tokensUsed }
}
