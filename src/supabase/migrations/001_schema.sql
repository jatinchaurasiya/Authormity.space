-- ============================================================
-- Authormity — Complete Database Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ─── ENUMS ────────────────────────────────────────────────────────────────────

CREATE TYPE plan_type AS ENUM ('free', 'pro', 'team');
CREATE TYPE plan_status_type AS ENUM ('active', 'cancelled', 'expired');
CREATE TYPE role_type AS ENUM ('owner', 'admin', 'member');
CREATE TYPE post_type AS ENUM ('post', 'hook', 'idea', 'carousel', 'thread', 'repurposed');
CREATE TYPE post_status_type AS ENUM ('draft', 'scheduled', 'published', 'archived', 'failed');
CREATE TYPE tone_type AS ENUM ('conversational', 'professional', 'motivational', 'analytical', 'direct');
CREATE TYPE sentence_length_type AS ENUM ('short', 'medium', 'long', 'mixed');
CREATE TYPE emoji_usage_type AS ENUM ('none', 'occasional', 'frequent');
CREATE TYPE hook_style_type AS ENUM ('question', 'bold-statement', 'story', 'statistic', 'list-promise');

-- ─── TEAMS ────────────────────────────────────────────────────────────────────

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  plan plan_type NOT NULL DEFAULT 'team',
  seats INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PROFILES ─────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  headline TEXT,
  avatar_url TEXT,
  linkedin_person_id TEXT NOT NULL DEFAULT '',
  linkedin_access_token TEXT NOT NULL DEFAULT '',
  linkedin_refresh_token TEXT NOT NULL DEFAULT '',
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '60 days',
  niche TEXT,
  target_audience TEXT,
  plan plan_type NOT NULL DEFAULT 'free',
  plan_status plan_status_type NOT NULL DEFAULT 'active',
  plan_expires_at TIMESTAMPTZ,
  posts_used_this_month INT NOT NULL DEFAULT 0,
  posts_reset_at TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
  dodo_customer_id TEXT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  role role_type NOT NULL DEFAULT 'owner',
  referral_code TEXT NOT NULL UNIQUE DEFAULT UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8)),
  referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── VOICE PROFILES ───────────────────────────────────────────────────────────

CREATE TABLE voice_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  sample_posts TEXT[] NOT NULL DEFAULT '{}',
  tone tone_type NOT NULL DEFAULT 'conversational',
  sentence_length sentence_length_type NOT NULL DEFAULT 'mixed',
  emoji_usage emoji_usage_type NOT NULL DEFAULT 'occasional',
  hook_style hook_style_type NOT NULL DEFAULT 'question',
  vocabulary TEXT[] NOT NULL DEFAULT '{}',
  avoids TEXT[] NOT NULL DEFAULT '{}',
  personality_traits TEXT[] NOT NULL DEFAULT '{}',
  signature TEXT NOT NULL DEFAULT '',
  raw_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CLIENTS (Ghostwriter) ────────────────────────────────────────────────────

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  niche TEXT,
  linkedin_url TEXT,
  voice_profile_id UUID REFERENCES voice_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── POSTS ────────────────────────────────────────────────────────────────────

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  title TEXT,
  content TEXT NOT NULL,
  type post_type NOT NULL DEFAULT 'post',
  platform TEXT NOT NULL DEFAULT 'linkedin',
  status post_status_type NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  linkedin_post_id TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  folder TEXT,
  is_swipe_file BOOLEAN NOT NULL DEFAULT FALSE,
  generation_prompt TEXT,
  word_count INT,
  character_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── POST VERSIONS ────────────────────────────────────────────────────────────

CREATE TABLE post_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version_number INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ANALYTICS — Post Level ───────────────────────────────────────────────────

CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  impressions INT NOT NULL DEFAULT 0,
  likes INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  reposts INT NOT NULL DEFAULT 0,
  follows_gained INT NOT NULL DEFAULT 0,
  engagement_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0
    THEN ROUND(((likes + comments + shares)::DECIMAL / impressions) * 100, 2)
    ELSE 0
    END
  ) STORED,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(post_id)
);

-- ─── PROFILE ANALYTICS — Follower Growth ─────────────────────────────────────

CREATE TABLE profile_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followers INT NOT NULL,
  connections INT,
  profile_views INT,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, recorded_date)
);

-- ─── TEAM MEMBERS ─────────────────────────────────────────────────────────────

CREATE TABLE team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role role_type NOT NULL DEFAULT 'member',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

-- ─── ENGAGEMENT QUEUE ─────────────────────────────────────────────────────────

CREATE TABLE engagement_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  linkedin_profile_url TEXT NOT NULL,
  notes TEXT,
  checked_off BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── COMMENT TEMPLATES ────────────────────────────────────────────────────────

CREATE TABLE comment_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── USAGE LOGS ───────────────────────────────────────────────────────────────

CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  model_used TEXT,
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── REFERRALS ────────────────────────────────────────────────────────────────

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bonus_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referred_id)
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled_at ON posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_posts_client_id ON posts(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_analytics_user_id ON analytics(user_id);
CREATE INDEX idx_analytics_post_id ON analytics(post_id);
CREATE INDEX idx_profile_analytics_user_id ON profile_analytics(user_id);
CREATE INDEX idx_engagement_queue_user_id ON engagement_queue(user_id);
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_post_versions_post_id ON post_versions(post_id);

-- ─── TRIGGERS ─────────────────────────────────────────────────────────────────

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER voice_profiles_updated_at BEFORE UPDATE ON voice_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-calculate word and character count on post save
CREATE OR REPLACE FUNCTION calculate_post_stats()
RETURNS TRIGGER AS $$
BEGIN
  NEW.word_count = ARRAY_LENGTH(REGEXP_SPLIT_TO_ARRAY(TRIM(NEW.content), '\s+'), 1);
  NEW.character_count = LENGTH(NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_calculate_stats BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION calculate_post_stats();

-- Auto-save version when post content changes
CREATE OR REPLACE FUNCTION save_post_version()
RETURNS TRIGGER AS $$
DECLARE
  version_count INT;
BEGIN
  IF OLD.content != NEW.content THEN
    SELECT COUNT(*) INTO version_count FROM post_versions WHERE post_id = NEW.id;
    
    -- Keep only last 10 versions
    IF version_count >= 10 THEN
      DELETE FROM post_versions
      WHERE post_id = NEW.id
        AND id = (
          SELECT id FROM post_versions
          WHERE post_id = NEW.id
          ORDER BY version_number ASC
          LIMIT 1
        );
    END IF;
    
    INSERT INTO post_versions (post_id, content, version_number)
    VALUES (NEW.id, OLD.content, COALESCE(version_count, 0) + 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_save_version BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION save_post_version();

-- ─── RPC FUNCTIONS ────────────────────────────────────────────────────────────

-- Increment posts used counter
CREATE OR REPLACE FUNCTION increment_posts_used(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET posts_used_this_month = posts_used_this_month + 1,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── ROW LEVEL SECURITY (RLS) ─────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "profiles: own read" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: own update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Voice profiles: own CRUD
CREATE POLICY "voice_profiles: own" ON voice_profiles USING (auth.uid() = user_id);
CREATE POLICY "voice_profiles: own insert" ON voice_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Posts: own CRUD
CREATE POLICY "posts: own" ON posts USING (auth.uid() = user_id);
CREATE POLICY "posts: own insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Post versions: own via posts
CREATE POLICY "post_versions: own" ON post_versions USING (
  auth.uid() = (SELECT user_id FROM posts WHERE id = post_id)
);

-- Analytics: own
CREATE POLICY "analytics: own" ON analytics USING (auth.uid() = user_id);
CREATE POLICY "analytics: own insert" ON analytics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Profile analytics: own
CREATE POLICY "profile_analytics: own" ON profile_analytics USING (auth.uid() = user_id);
CREATE POLICY "profile_analytics: own insert" ON profile_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Clients: own
CREATE POLICY "clients: own" ON clients USING (auth.uid() = user_id);
CREATE POLICY "clients: own insert" ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Teams: owner or member
CREATE POLICY "teams: member read" ON teams FOR SELECT USING (
  auth.uid() = owner_id OR
  EXISTS (SELECT 1 FROM team_members WHERE team_id = teams.id AND user_id = auth.uid())
);

-- Team members: same team
CREATE POLICY "team_members: same team" ON team_members FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM teams WHERE id = team_id AND owner_id = auth.uid())
);

-- Engagement queue: own
CREATE POLICY "engagement_queue: own" ON engagement_queue USING (auth.uid() = user_id);
CREATE POLICY "engagement_queue: own insert" ON engagement_queue FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Comment templates: own
CREATE POLICY "comment_templates: own" ON comment_templates USING (auth.uid() = user_id);
CREATE POLICY "comment_templates: own insert" ON comment_templates FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usage logs: own read only
CREATE POLICY "usage_logs: own read" ON usage_logs FOR SELECT USING (auth.uid() = user_id);

-- Referrals: own
CREATE POLICY "referrals: own" ON referrals USING (
  auth.uid() = referrer_id OR auth.uid() = referred_id
);
