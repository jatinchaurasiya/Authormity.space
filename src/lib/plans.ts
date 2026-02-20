import type { Feature, Plan, CanGenerateResult } from '@/types'
import { createAdminClient } from '@/lib/supabase-server'

// ─── Plan Feature Gate Map ─────────────────────────────────────────────────────

const FEATURE_REQUIREMENTS: Record<Feature, Plan[]> = {
    voiceProfile: ['pro', 'team'],
    carousel: ['pro', 'team'],
    directPosting: ['pro', 'team'],
    repurpose: ['pro', 'team'],
    commentGenerator: ['pro', 'team'],
    ghostwriterMode: ['pro', 'team'],
    analytics: ['pro', 'team'],
    scheduling: ['pro', 'team'],
    threadWriter: ['pro', 'team'],
    hookRater: ['pro', 'team'],
    humanizer: ['pro', 'team'],
    weeklyInsights: ['pro', 'team'],
    teamWorkspace: ['team'],
    clientProfiles: ['pro', 'team'],
}

// ─── Plan Limits ──────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<Plan, number> = {
    free: 10,
    pro: Infinity,
    team: Infinity,
}

// ─── Plan Metadata ────────────────────────────────────────────────────────────

export const PLAN_METADATA = {
    free: {
        name: 'Free',
        price: '$0',
        priceAnnual: '$0',
        description: 'For creators getting started',
        postsLimit: 10,
        features: [
            '10 AI post generations/month',
            'Basic post generator',
            'Content library',
            'Copy to clipboard',
        ],
        notIncluded: [
            'Voice profile',
            'Scheduling',
            'Analytics',
            'Carousel & Thread builder',
            'Content repurposer',
            'Comment generator',
            'Ghostwriter mode',
        ],
    },
    pro: {
        name: 'Pro',
        price: '$19',
        priceAnnual: '$159',
        description: 'For serious LinkedIn creators',
        postsLimit: Infinity,
        features: [
            'Unlimited AI generations',
            'Voice profile (sounds like you)',
            'Direct LinkedIn publishing',
            'Content scheduling & calendar',
            'Analytics dashboard',
            'Carousel outline generator',
            'Thread writer',
            'Content repurposer',
            'Comment generator',
            'Hook rater & humanizer',
            'Client profiles (ghostwriter)',
            'Weekly AI insights',
            'Swipe file & idea bank',
        ],
        notIncluded: ['Team collaboration', 'Multi-seat access'],
    },
    team: {
        name: 'Team',
        price: '$49',
        priceAnnual: '$399',
        description: 'For agencies & ghostwriting teams',
        postsLimit: Infinity,
        features: [
            'Everything in Pro',
            '3 team seats included',
            'Shared content library & calendar',
            'Client profile management',
            'Team collaboration & comments',
            'Approval workflow',
            'Role management (Owner/Admin/Member)',
            'Per-client content isolation',
            'Exportable client reports',
        ],
        notIncluded: [],
    },
} as const

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Check if a user on a given plan can access a specific feature.
 */
export function canUseFeature(plan: Plan, feature: Feature): boolean {
    const requiredPlans = FEATURE_REQUIREMENTS[feature]
    return requiredPlans.includes(plan)
}

/**
 * Check if a user can generate more content this month.
 * Returns allowed status, reason, and usage counts.
 */
export async function checkCanGenerate(
    userId: string
): Promise<CanGenerateResult> {
    const supabase = createAdminClient()

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('plan, posts_used_this_month, posts_reset_at')
        .eq('id', userId)
        .single()

    if (error || !profile) {
        return { allowed: false, reason: 'Profile not found', postsUsed: 0, limit: 0 }
    }

    const plan = profile.plan as Plan
    const limit = PLAN_LIMITS[plan]
    const postsUsed = profile.posts_used_this_month ?? 0

    if (limit === Infinity) {
        return { allowed: true, postsUsed, limit }
    }

    if (postsUsed >= limit) {
        return {
            allowed: false,
            reason: `You've used all ${limit} generations for this month. Upgrade to Pro for unlimited.`,
            postsUsed,
            limit,
        }
    }

    return { allowed: true, postsUsed, limit }
}

/**
 * Reset monthly post counter if past reset date.
 */
export async function resetMonthlyCounterIfNeeded(userId: string): Promise<void> {
    const supabase = createAdminClient()

    const { data: profile } = await supabase
        .from('profiles')
        .select('posts_reset_at')
        .eq('id', userId)
        .single()

    if (!profile) return

    const resetAt = new Date(profile.posts_reset_at)
    const now = new Date()

    if (now >= resetAt) {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        nextMonth.setDate(1)
        nextMonth.setHours(0, 0, 0, 0)

        await supabase
            .from('profiles')
            .update({
                posts_used_this_month: 0,
                posts_reset_at: nextMonth.toISOString(),
            })
            .eq('id', userId)
    }
}

/**
 * Increment the monthly post counter for a user.
 */
export async function incrementPostsUsed(userId: string): Promise<void> {
    const supabase = createAdminClient()

    await supabase.rpc('increment_posts_used', { user_id: userId })
}
