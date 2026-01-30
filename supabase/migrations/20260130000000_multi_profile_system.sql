-- Multi-Profile System Migration
-- Migration: multi_profile_system
--
-- Changes:
-- 1. Create users table for app-level user records
-- 2. Update user_access to use user_id instead of user_email
-- 3. Create pending_uploads table for PDF upload workflow
-- 4. Add claimed tracking to profile_allowed_emails

-- ============================================================================
-- USERS TABLE
-- App-level user records (separate from auth.users for portability)
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Trigger for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- UPDATE USER_ACCESS TABLE
-- Migrate from user_email to user_id reference
-- ============================================================================

-- Step 1: Add user_id column (nullable initially for migration)
ALTER TABLE user_access
ADD COLUMN user_id_new UUID REFERENCES users(id) ON DELETE CASCADE;

-- Step 2: Create users for existing user_email entries and link them
-- This inserts users for each unique email in user_access
INSERT INTO users (email, created_at)
SELECT DISTINCT user_email, granted_at
FROM user_access
WHERE user_email IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- Step 3: Update user_access with the new user_id references
UPDATE user_access ua
SET user_id_new = u.id
FROM users u
WHERE ua.user_email = u.email;

-- Step 4: Drop old user_email column and rename user_id_new
ALTER TABLE user_access DROP COLUMN user_email;
ALTER TABLE user_access RENAME COLUMN user_id_new TO user_id;

-- Step 5: Make user_id NOT NULL now that all rows have values
ALTER TABLE user_access ALTER COLUMN user_id SET NOT NULL;

-- Step 6: Recreate unique constraint
ALTER TABLE user_access DROP CONSTRAINT IF EXISTS user_access_user_email_profile_id_key;
ALTER TABLE user_access ADD CONSTRAINT user_access_user_profile_unique UNIQUE(user_id, profile_id);

-- Step 7: Update indexes
DROP INDEX IF EXISTS idx_user_access_user;
CREATE INDEX idx_user_access_user_id ON user_access(user_id);

-- ============================================================================
-- PENDING_UPLOADS TABLE
-- Temporary storage for PDF uploads before confirmation
-- ============================================================================
CREATE TABLE pending_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    file_url TEXT, -- Vercel Blob URL
    extracted_data JSONB, -- { sample_date, metrics: [{name, value, unit, ref_low, ref_high}] }
    sample_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'extracting', 'review', 'confirmed', 'rejected')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX idx_pending_uploads_user ON pending_uploads(user_id);
CREATE INDEX idx_pending_uploads_profile ON pending_uploads(profile_id);
CREATE INDEX idx_pending_uploads_status ON pending_uploads(status);
CREATE INDEX idx_pending_uploads_hash ON pending_uploads(content_hash);

-- Trigger for updated_at
CREATE TRIGGER update_pending_uploads_updated_at
    BEFORE UPDATE ON pending_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- UPDATE PROFILE_ALLOWED_EMAILS
-- Add tracking for when emails are claimed
-- ============================================================================
ALTER TABLE profile_allowed_emails
ADD COLUMN claimed_at TIMESTAMPTZ,
ADD COLUMN claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Mark existing entries as claimed if there's a corresponding user_access entry
UPDATE profile_allowed_emails pae
SET
    claimed_at = ua.granted_at,
    claimed_by_user_id = ua.user_id
FROM user_access ua
JOIN users u ON u.id = ua.user_id
WHERE pae.email = u.email
AND pae.profile_id = ua.profile_id;

-- ============================================================================
-- ADD USER METRIC PREFERENCES TABLE
-- Store per-user, per-profile metric ordering preferences
-- ============================================================================
CREATE TABLE user_metric_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    metric_order TEXT[], -- Array of metric names in preferred order
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, profile_id)
);

-- Indexes
CREATE INDEX idx_user_metric_prefs_user ON user_metric_preferences(user_id);
CREATE INDEX idx_user_metric_prefs_profile ON user_metric_preferences(profile_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_metric_prefs_updated_at
    BEFORE UPDATE ON user_metric_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PROCESSED FILES TABLE UPDATE
-- Add user tracking for who uploaded each file
-- ============================================================================
ALTER TABLE processed_files
ADD COLUMN uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get or create a user by email
CREATE OR REPLACE FUNCTION upsert_user(
    p_email TEXT,
    p_name TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Try to find existing user
    SELECT id INTO v_user_id FROM users WHERE email = p_email;

    IF v_user_id IS NULL THEN
        -- Create new user
        INSERT INTO users (email, name, avatar_url)
        VALUES (p_email, p_name, p_avatar_url)
        RETURNING id INTO v_user_id;
    ELSE
        -- Update existing user if name/avatar provided
        IF p_name IS NOT NULL OR p_avatar_url IS NOT NULL THEN
            UPDATE users
            SET
                name = COALESCE(p_name, name),
                avatar_url = COALESCE(p_avatar_url, avatar_url),
                updated_at = NOW()
            WHERE id = v_user_id;
        END IF;
    END IF;

    RETURN v_user_id;
END;
$$;

-- Function to claim profiles for a user based on allowed emails
CREATE OR REPLACE FUNCTION claim_profiles_for_user(
    p_user_id UUID,
    p_user_email TEXT
)
RETURNS TABLE (
    profile_id UUID,
    profile_name TEXT,
    newly_claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        UPDATE profile_allowed_emails pae
        SET
            claimed_at = NOW(),
            claimed_by_user_id = p_user_id
        FROM profiles p
        WHERE pae.email = p_user_email
        AND pae.claimed_at IS NULL
        AND pae.profile_id = p.id
        RETURNING pae.profile_id, p.display_name
    ),
    access_created AS (
        INSERT INTO user_access (user_id, profile_id, access_level, granted_by)
        SELECT p_user_id, c.profile_id, 'owner', p_user_id
        FROM claimed c
        ON CONFLICT (user_id, profile_id) DO NOTHING
        RETURNING profile_id
    ),
    newly_claimed AS (
        SELECT c.profile_id, c.display_name, TRUE as newly_claimed
        FROM claimed c
    ),
    existing_access AS (
        SELECT ua.profile_id, p.display_name, FALSE as newly_claimed
        FROM user_access ua
        JOIN profiles p ON p.id = ua.profile_id
        WHERE ua.user_id = p_user_id
        AND ua.profile_id NOT IN (SELECT nc.profile_id FROM newly_claimed nc)
    )
    SELECT * FROM newly_claimed
    UNION ALL
    SELECT * FROM existing_access;
END;
$$;

-- Function to check if a content hash already exists for a profile
CREATE OR REPLACE FUNCTION check_duplicate_upload(
    p_profile_id UUID,
    p_content_hash TEXT
)
RETURNS TABLE (
    is_duplicate BOOLEAN,
    existing_report_id UUID,
    existing_sample_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        TRUE as is_duplicate,
        pf.report_id,
        r.sample_date
    FROM processed_files pf
    JOIN reports r ON r.id = pf.report_id
    WHERE pf.profile_id = p_profile_id
    AND pf.content_hash = p_content_hash
    LIMIT 1;

    -- If no rows returned, return a "not duplicate" row
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::DATE;
    END IF;
END;
$$;

-- ============================================================================
-- CLEANUP FUNCTION FOR EXPIRED PENDING UPLOADS
-- Can be called periodically via cron or on-demand
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_pending_uploads()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM pending_uploads
    WHERE expires_at < NOW()
    AND status IN ('pending', 'extracting', 'review');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
