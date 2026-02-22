// ─── Auth / Users ─────────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro' | 'team'
export type PlanStatus = 'active' | 'cancelled' | 'expired'
export type Role = 'owner' | 'admin' | 'member'

export interface Profile {
    id: string
    email: string
    name: string
    headline: string | null
    avatar_url: string | null
    linkedin_person_id: string
    linkedin_access_token: string
    linkedin_refresh_token: string
    token_expires_at: string
    niche: string | null
    target_audience: string | null
    plan: Plan
    plan_status: PlanStatus
    plan_expires_at: string | null
    posts_used_this_month: number
    posts_reset_at: string
    dodo_customer_id: string | null
    team_id: string | null
    role: Role
    referral_code: string
    referred_by: string | null
    onboarding_completed: boolean
    created_at: string
    updated_at: string
}

// ─── Voice Profile ─────────────────────────────────────────────────────────────

export type Tone = 'conversational' | 'professional' | 'motivational' | 'analytical' | 'direct'
export type SentenceLength = 'short' | 'medium' | 'long' | 'mixed'
export type EmojiUsage = 'none' | 'occasional' | 'frequent'
export type HookStyle = 'question' | 'bold-statement' | 'story' | 'statistic' | 'list-promise'

export interface VoiceProfile {
    id: string
    user_id: string
    sample_posts: string[]
    tone: Tone
    sentence_length: SentenceLength
    emoji_usage: EmojiUsage
    hook_style: HookStyle
    vocabulary: string[]
    avoids: string[]
    personality_traits: string[]
    signature: string
    raw_analysis: Record<string, unknown> | null
    created_at: string
    updated_at: string
}

// ─── Posts ─────────────────────────────────────────────────────────────────────

export type PostType = 'post' | 'hook' | 'idea' | 'carousel' | 'thread' | 'repurposed'
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'archived' | 'failed'
export type PostPlatform = 'linkedin'

export interface Post {
    id: string
    user_id: string
    client_id: string | null
    team_id: string | null
    title: string | null
    content: string
    type: PostType
    platform: PostPlatform
    status: PostStatus
    scheduled_at: string | null
    published_at: string | null
    linkedin_post_id: string | null
    tags: string[]
    folder: string | null
    is_swipe_file: boolean
    generation_prompt: string | null
    word_count: number | null
    character_count: number | null
    created_at: string
    updated_at: string
}

export interface PostVersion {
    id: string
    post_id: string
    content: string
    version_number: number
    created_at: string
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

export interface PostAnalytics {
    id: string
    post_id: string
    user_id: string
    impressions: number
    likes: number
    comments: number
    shares: number
    reposts: number
    follows_gained: number
    engagement_rate: number
    recorded_date: string
}

export interface ProfileAnalytics {
    id: string
    user_id: string
    followers: number
    connections: number | null
    profile_views: number | null
    recorded_date: string
}

// ─── Team ──────────────────────────────────────────────────────────────────────

export interface Team {
    id: string
    name: string
    owner_id: string
    plan: Plan
    seats: number
    created_at: string
}

export interface TeamMember {
    team_id: string
    user_id: string
    role: 'admin' | 'member'
    invited_at: string
}

// ─── Clients (Ghostwriter) ────────────────────────────────────────────────────

export interface Client {
    id: string
    user_id: string
    name: string
    niche: string | null
    linkedin_url: string | null
    voice_profile_id: string | null
    created_at: string
    updated_at: string
}

// ─── Engagement ────────────────────────────────────────────────────────────────

export interface EngagementQueueItem {
    id: string
    user_id: string
    linkedin_profile_url: string
    notes: string | null
    checked_off: boolean
    created_at: string
}

export interface CommentTemplate {
    id: string
    user_id: string
    label: string
    content: string
    created_at: string
}

// ─── Usage & Billing ──────────────────────────────────────────────────────────

export interface UsageLog {
    id: string
    user_id: string
    action: string
    model_used: string | null
    tokens_used: number | null
    created_at: string
}

export interface Referral {
    id: string
    referrer_id: string
    referred_id: string
    bonus_applied: boolean
    created_at: string
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export type GenerateType =
    | 'post'
    | 'hooks'
    | 'ideas'
    | 'repurpose'
    | 'rateHook'
    | 'analyzeVoice'
    | 'comment'
    | 'humanize'
    | 'carousel'
    | 'thread'
    | 'connectionMessage'
    | 'weeklyInsights'

export interface GenerateRequest {
    type: GenerateType
    topic?: string
    tone?: string
    length?: 'short' | 'medium' | 'long'
    useVoice?: boolean
    slideCount?: number
    threadCount?: number
    hookText?: string
    samplePosts?: string[]
    postText?: string
    commentIntent?: 'add-value' | 'agree-expand' | 'disagree' | 'question'
    sourceType?: 'blog' | 'tweet' | 'transcript' | 'newsletter' | 'other'
    sourceContent?: string
    personRole?: string
    clientId?: string
}

export interface GenerateResponse {
    content: string
    error?: string
}

// ─── Plan Gating ──────────────────────────────────────────────────────────────

export type Feature =
    | 'voiceProfile'
    | 'carousel'
    | 'directPosting'
    | 'repurpose'
    | 'commentGenerator'
    | 'ghostwriterMode'
    | 'analytics'
    | 'scheduling'
    | 'threadWriter'
    | 'teamWorkspace'
    | 'clientProfiles'
    | 'weeklyInsights'
    | 'hookRater'
    | 'humanizer'

export interface CanGenerateResult {
    allowed: boolean
    reason?: string
    postsUsed: number
    limit: number
}

// ─── LinkedIn API ─────────────────────────────────────────────────────────────

export interface LinkedInUserInfo {
    sub: string
    name: string
    given_name: string
    family_name: string
    picture: string
    email: string
    email_verified: boolean
    locale: { country: string; language: string }
}

export interface LinkedInTokenResponse {
    access_token: string
    expires_in: number
    refresh_token: string
    refresh_token_expires_in: number
    token_type: string
    scope: string
}

// ─── Supabase DB Types (Postgrest v12 compatible) ────────────────────────────
//
// Each table MUST have a Relationships key (even if empty []).
// Without it, @supabase/ssr v12's type engine narrows all table
// operations to `never`, causing TS2345 / TS2769 in tsc --noEmit.

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
export type ProfileUpdate = Partial<Omit<Profile, 'id'>>
export type VoiceProfileInsert = Omit<VoiceProfile, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
export type VoiceProfileUpdate = Partial<Omit<VoiceProfile, 'id'>>
export type PostInsert = Omit<Post, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
export type PostUpdate = Partial<Omit<Post, 'id'>>
export type UsageLogInsert = Omit<UsageLog, 'id' | 'created_at'> & { id?: string; created_at?: string }

// Table helper – every table entry must include Relationships for Postgrest v12
type TableDef<R, I, U> = { Row: R; Insert: I; Update: U; Relationships: [] }

export interface Database {
    public: {
        Tables: {
            profiles: TableDef<Profile, ProfileInsert, ProfileUpdate>
            voice_profiles: TableDef<VoiceProfile, VoiceProfileInsert, VoiceProfileUpdate>
            posts: TableDef<Post, PostInsert, PostUpdate>
            post_versions: TableDef<PostVersion, Partial<PostVersion>, Partial<Omit<PostVersion, 'id'>>>
            analytics: TableDef<PostAnalytics, Partial<PostAnalytics>, Partial<Omit<PostAnalytics, 'id'>>>
            profile_analytics: TableDef<ProfileAnalytics, Partial<ProfileAnalytics>, Partial<Omit<ProfileAnalytics, 'id'>>>
            teams: TableDef<Team, Partial<Team>, Partial<Omit<Team, 'id'>>>
            team_members: TableDef<TeamMember, Partial<TeamMember>, Partial<TeamMember>>
            clients: TableDef<Client, Partial<Client>, Partial<Omit<Client, 'id'>>>
            engagement_queue: TableDef<EngagementQueueItem, Partial<EngagementQueueItem>, Partial<Omit<EngagementQueueItem, 'id'>>>
            comment_templates: TableDef<CommentTemplate, Partial<CommentTemplate>, Partial<Omit<CommentTemplate, 'id'>>>
            usage_logs: TableDef<UsageLog, UsageLogInsert, Partial<Omit<UsageLog, 'id'>>>
            referrals: TableDef<Referral, Partial<Referral>, Partial<Omit<Referral, 'id'>>>
        }
        Views: Record<string, never>
        Functions: Record<string, never>
        Enums: Record<string, never>
        CompositeTypes: Record<string, never>
    }
}
