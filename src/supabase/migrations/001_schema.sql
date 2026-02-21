-- ============================================================
-- Authormity — Production Database Schema
-- Migration: 001_schema.sql
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────
CREATE TYPE plan_type   AS ENUM ('free', 'pro', 'team');
CREATE TYPE plan_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published', 'failed');
CREATE TYPE post_type   AS ENUM ('post', 'carousel', 'thread', 'hooks', 'ideas', 'repurpose');
CREATE TYPE team_role   AS ENUM ('owner', 'admin', 'member');

-- ============================================================
-- TABLES
-- ============================================================

-- ─── teams (created before profiles to allow FK) ───────────
CREATE TABLE teams (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    owner_id   UUID, -- FK added after profiles
    plan       TEXT NOT NULL DEFAULT 'team',
    seats      INT  NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── profiles ───────────────────────────────────────────────
CREATE TABLE profiles (
    id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email                TEXT NOT NULL,
    name                 TEXT NOT NULL,
    headline             TEXT,
    avatar_url           TEXT,
    linkedin_person_id   TEXT NOT NULL DEFAULT '',
    linkedin_access_token  TEXT,
    linkedin_refresh_token TEXT,
    token_expires_at     TIMESTAMPTZ,
    niche                TEXT,
    target_audience      TEXT,
    plan                 TEXT NOT NULL DEFAULT 'free',
    plan_status          TEXT NOT NULL DEFAULT 'active',
    plan_expires_at      TIMESTAMPTZ,
    posts_used_this_month INT          NOT NULL DEFAULT 0,
    posts_reset_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    dodo_customer_id     TEXT,
    team_id              UUID REFERENCES teams(id) ON DELETE SET NULL,
    role                 TEXT         NOT NULL DEFAULT 'owner',
    referral_code        TEXT         NOT NULL UNIQUE,
    referred_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    onboarding_completed BOOLEAN      NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Back-fill the teams.owner_id FK now that profiles exists
ALTER TABLE teams
    ADD CONSTRAINT teams_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── team_members ────────────────────────────────────────────
CREATE TABLE team_members (
    team_id    UUID REFERENCES teams(id)    ON DELETE CASCADE,
    user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role       TEXT        NOT NULL DEFAULT 'member',
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- ─── voice_profiles ──────────────────────────────────────────
CREATE TABLE voice_profiles (
    id                 UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID  UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    sample_posts       TEXT[],
    tone               TEXT,
    sentence_length    TEXT,
    emoji_usage        TEXT,
    hook_style         TEXT,
    vocabulary         TEXT[],
    avoids             TEXT[],
    personality_traits TEXT[],
    signature          TEXT,
    raw_analysis       JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── clients ────────────────────────────────────────────────
CREATE TABLE clients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    email           TEXT,
    niche           TEXT,
    target_audience TEXT,
    voice_profile_id UUID REFERENCES voice_profiles(id) ON DELETE SET NULL,
    notes           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── posts ──────────────────────────────────────────────────
CREATE TABLE posts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
    team_id           UUID REFERENCES teams(id)   ON DELETE SET NULL,
    title             TEXT,
    content           TEXT NOT NULL,
    type              TEXT NOT NULL,
    platform          TEXT NOT NULL DEFAULT 'linkedin',
    status            TEXT NOT NULL DEFAULT 'draft',
    scheduled_at      TIMESTAMPTZ,
    published_at      TIMESTAMPTZ,
    linkedin_post_id  TEXT,
    tags              TEXT[],
    folder            TEXT,
    is_swipe_file     BOOLEAN NOT NULL DEFAULT false,
    generation_prompt TEXT,
    word_count        INT,
    character_count   INT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── post_versions ───────────────────────────────────────────
CREATE TABLE post_versions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id        UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content        TEXT NOT NULL,
    version_number INT  NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── analytics ───────────────────────────────────────────────
CREATE TABLE analytics (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id        UUID UNIQUE REFERENCES posts(id)    ON DELETE CASCADE,
    user_id        UUID        REFERENCES profiles(id) ON DELETE CASCADE,
    impressions    INT  NOT NULL DEFAULT 0,
    likes          INT  NOT NULL DEFAULT 0,
    comments       INT  NOT NULL DEFAULT 0,
    shares         INT  NOT NULL DEFAULT 0,
    reposts        INT  NOT NULL DEFAULT 0,
    follows_gained INT  NOT NULL DEFAULT 0,
    engagement_rate DECIMAL(5,2),
    recorded_date  DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ─── profile_analytics ───────────────────────────────────────
CREATE TABLE profile_analytics (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    followers     INT  NOT NULL,
    connections   INT,
    profile_views INT,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (user_id, recorded_date)
);

-- ─── usage_logs ──────────────────────────────────────────────
CREATE TABLE usage_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action     TEXT,
    model_used TEXT,
    tokens_used INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── referrals ───────────────────────────────────────────────
CREATE TABLE referrals (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    referred_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    bonus_applied BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_profiles_team_id      ON profiles(team_id);
CREATE INDEX idx_profiles_plan         ON profiles(plan);
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX idx_profiles_referred_by  ON profiles(referred_by);

CREATE INDEX idx_teams_owner_id        ON teams(owner_id);

CREATE INDEX idx_team_members_user_id  ON team_members(user_id);

CREATE INDEX idx_voice_profiles_user_id ON voice_profiles(user_id);

CREATE INDEX idx_clients_user_id       ON clients(user_id);

CREATE INDEX idx_posts_user_id         ON posts(user_id);
CREATE INDEX idx_posts_status          ON posts(status);
CREATE INDEX idx_posts_scheduled_at    ON posts(scheduled_at);
CREATE INDEX idx_posts_client_id       ON posts(client_id);
CREATE INDEX idx_posts_team_id         ON posts(team_id);

CREATE INDEX idx_post_versions_post_id ON post_versions(post_id);

CREATE INDEX idx_analytics_user_id     ON analytics(user_id);

CREATE INDEX idx_profile_analytics_user_id ON profile_analytics(user_id);

CREATE INDEX idx_usage_logs_user_id    ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);

CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON referrals(referred_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- ─── updated_at trigger function ────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_voice_profiles_updated_at
    BEFORE UPDATE ON voice_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── auto-generate referral_code on profile insert ──────────
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    code TEXT;
    max_attempts INT := 10;
    attempts INT := 0;
BEGIN
    IF NEW.referral_code IS NOT NULL AND NEW.referral_code <> '' THEN
        RETURN NEW;
    END IF;
    LOOP
        code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = code);
        attempts := attempts + 1;
        IF attempts >= max_attempts THEN
            code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 12));
            EXIT;
        END IF;
    END LOOP;
    NEW.referral_code := code;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_referral_code
    BEFORE INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- ─── auto-create profile on auth.users insert ───────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, referral_code)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        ''  -- will be filled by generate_referral_code trigger
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── auto-compute word/character count on post upsert ───────
CREATE OR REPLACE FUNCTION compute_post_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.character_count := length(NEW.content);
    NEW.word_count      := array_length(regexp_split_to_array(trim(NEW.content), '\s+'), 1);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_posts_counts
    BEFORE INSERT OR UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION compute_post_counts();

-- ─── save post version on content change ────────────────────
CREATE OR REPLACE FUNCTION save_post_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    next_version INT;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
        SELECT COALESCE(MAX(version_number), 0) + 1
        INTO next_version
        FROM post_versions
        WHERE post_id = NEW.id;

        INSERT INTO post_versions (post_id, content, version_number)
        VALUES (NEW.id, OLD.content, next_version);

        -- Prune: keep only last 20 versions
        DELETE FROM post_versions
        WHERE post_id = NEW.id
          AND id NOT IN (
              SELECT id FROM post_versions
              WHERE post_id = NEW.id
              ORDER BY version_number DESC
              LIMIT 20
          );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_posts_versioning
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION save_post_version();

-- ─── monthly usage reset function ───────────────────────────
-- Call this from your API before checking/incrementing usage.
-- It resets posts_used_this_month if posts_reset_at is > 30 days ago.
CREATE OR REPLACE FUNCTION reset_monthly_usage(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE profiles
    SET
        posts_used_this_month = 0,
        posts_reset_at        = NOW()
    WHERE id = p_user_id
      AND posts_reset_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ─── engagement_rate auto-compute ───────────────────────────
CREATE OR REPLACE FUNCTION compute_engagement_rate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.impressions > 0 THEN
        NEW.engagement_rate := ROUND(
            (NEW.likes + NEW.comments + NEW.shares + NEW.reposts)::DECIMAL
            / NEW.impressions * 100,
            2
        );
    ELSE
        NEW.engagement_rate := 0;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analytics_engagement_rate
    BEFORE INSERT OR UPDATE ON analytics
    FOR EACH ROW EXECUTE FUNCTION compute_engagement_rate();

-- ─── apply referral bonus on first paid plan ────────────────
CREATE OR REPLACE FUNCTION apply_referral_bonus()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- When a new user's plan changes from 'free' to paid
    IF TG_OP = 'UPDATE'
       AND OLD.plan = 'free'
       AND NEW.plan <> 'free'
       AND NEW.referred_by IS NOT NULL THEN

        UPDATE referrals
        SET bonus_applied = true
        WHERE referred_id = NEW.id
          AND referrer_id = NEW.referred_by
          AND bonus_applied = false;

        -- Give referrer 10 bonus posts this month
        UPDATE profiles
        SET posts_used_this_month = GREATEST(0, posts_used_this_month - 10)
        WHERE id = NEW.referred_by;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_referral_bonus
    AFTER UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION apply_referral_bonus();

-- ─── insert referral record when referred user signs up ─────
CREATE OR REPLACE FUNCTION record_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.referred_by IS NOT NULL THEN
        INSERT INTO referrals (referrer_id, referred_id)
        VALUES (NEW.referred_by, NEW.id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_record_referral
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION record_referral();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals        ENABLE ROW LEVEL SECURITY;

-- ─── profiles ────────────────────────────────────────────────
CREATE POLICY "profiles: read own"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles: update own"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "profiles: insert own"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Allow reading team-mates' basic info (name, avatar, role)
CREATE POLICY "profiles: team members can read peers"
    ON profiles FOR SELECT
    USING (
        team_id IS NOT NULL
        AND team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- ─── teams ───────────────────────────────────────────────────
CREATE POLICY "teams: owner full access"
    ON teams FOR ALL
    USING (owner_id = auth.uid());

CREATE POLICY "teams: members can read"
    ON teams FOR SELECT
    USING (
        id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- ─── team_members ────────────────────────────────────────────
CREATE POLICY "team_members: member can read own team"
    ON team_members FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "team_members: owner can manage"
    ON team_members FOR ALL
    USING (
        team_id IN (
            SELECT id FROM teams WHERE owner_id = auth.uid()
        )
    );

-- ─── voice_profiles ──────────────────────────────────────────
CREATE POLICY "voice_profiles: own"
    ON voice_profiles FOR ALL
    USING (user_id = auth.uid());

-- ─── clients ─────────────────────────────────────────────────
CREATE POLICY "clients: own"
    ON clients FOR ALL
    USING (user_id = auth.uid());

-- ─── posts ───────────────────────────────────────────────────
CREATE POLICY "posts: own"
    ON posts FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "posts: team members can read team posts"
    ON posts FOR SELECT
    USING (
        team_id IS NOT NULL
        AND team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- ─── post_versions ───────────────────────────────────────────
CREATE POLICY "post_versions: own via post"
    ON post_versions FOR ALL
    USING (
        post_id IN (
            SELECT id FROM posts WHERE user_id = auth.uid()
        )
    );

-- ─── analytics ───────────────────────────────────────────────
CREATE POLICY "analytics: own"
    ON analytics FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "analytics: team members can read"
    ON analytics FOR SELECT
    USING (
        post_id IN (
            SELECT id FROM posts
            WHERE team_id IN (
                SELECT team_id FROM team_members WHERE user_id = auth.uid()
            )
        )
    );

-- ─── profile_analytics ───────────────────────────────────────
CREATE POLICY "profile_analytics: own"
    ON profile_analytics FOR ALL
    USING (user_id = auth.uid());

-- ─── usage_logs ──────────────────────────────────────────────
CREATE POLICY "usage_logs: own read"
    ON usage_logs FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "usage_logs: service role insert"
    ON usage_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ─── referrals ───────────────────────────────────────────────
CREATE POLICY "referrals: read own"
    ON referrals FOR SELECT
    USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- ============================================================
-- GRANTS (for service_role bypass — Supabase default)
-- ============================================================
-- service_role bypasses RLS by default in Supabase.
-- Additional anon/authenticated grants are not required
-- as Supabase grants SELECT/INSERT/UPDATE/DELETE to
-- authenticated role and RLS policies control access.
