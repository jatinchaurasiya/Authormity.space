BEGIN;

-- ============================================================
-- 1) ENUM COLUMN CONVERSIONS
-- ============================================================

ALTER TABLE profiles
    ALTER COLUMN plan        TYPE plan_type   USING plan::plan_type,
    ALTER COLUMN plan_status TYPE plan_status USING plan_status::plan_status;

ALTER TABLE posts
    ALTER COLUMN type   TYPE post_type   USING type::post_type,
    ALTER COLUMN status TYPE post_status USING status::post_status;

ALTER TABLE team_members
    ALTER COLUMN role TYPE team_role USING role::team_role;

-- ============================================================
-- 2) REPLACE UNSAFE PEER-READ POLICY WITH SAFE VIEW
-- ============================================================

DROP POLICY IF EXISTS "profiles: team members can read peers" ON profiles;

CREATE OR REPLACE VIEW team_profile_public
    WITH (security_invoker = true)
AS
SELECT
    p.id,
    p.name,
    p.avatar_url,
    p.role,
    p.team_id
FROM profiles p
WHERE p.team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
);

GRANT SELECT ON team_profile_public TO authenticated;

-- ============================================================
-- 3) HARDEN usage_logs INSERT POLICY
-- ============================================================

DROP POLICY IF EXISTS "usage_logs: service role insert" ON usage_logs;

CREATE POLICY "usage_logs: authenticated insert own"
    ON usage_logs FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 4) SAFETY CONSTRAINTS
-- ============================================================

ALTER TABLE teams
    ADD CONSTRAINT chk_teams_seats_positive
    CHECK (seats > 0);

ALTER TABLE profiles
    ADD CONSTRAINT chk_profiles_posts_used_nonneg
    CHECK (posts_used_this_month >= 0);

ALTER TABLE analytics
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN post_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_scheduler
    ON posts(status, scheduled_at);

-- ============================================================
-- 5) NOT NULL ENFORCEMENT ON FOREIGN KEYS
-- ============================================================

ALTER TABLE post_versions
    ALTER COLUMN post_id SET NOT NULL;

-- analytics columns already set NOT NULL in step 4

-- ============================================================
-- 6) REVOKE ANONYMOUS ACCESS TO SENSITIVE TABLES
-- ============================================================

REVOKE ALL ON profiles   FROM anon;
REVOKE ALL ON usage_logs FROM anon;

COMMIT;
