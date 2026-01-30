-- Profile Allowed Emails Migration
--
-- Allows multiple email addresses to access a single profile.
-- When a user logs in with Google, we check if their email is in this table.
-- If yes, they get access to that profile. If no, they are rejected.

-- ============================================================================
-- CREATE ALLOWED EMAILS TABLE
-- ============================================================================
CREATE TABLE profile_allowed_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each email can only be assigned to one profile
    UNIQUE(email)
);

-- Index for fast email lookups during login
CREATE INDEX idx_profile_allowed_emails_email ON profile_allowed_emails(email);
CREATE INDEX idx_profile_allowed_emails_profile ON profile_allowed_emails(profile_id);

-- ============================================================================
-- FUNCTION TO CHECK IF EMAIL IS ALLOWED
-- Returns the profile_id if email is allowed, NULL otherwise
-- ============================================================================
CREATE OR REPLACE FUNCTION check_email_allowed(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    SELECT profile_id INTO v_profile_id
    FROM profile_allowed_emails
    WHERE email = p_email
    LIMIT 1;

    RETURN v_profile_id;
END;
$$;

-- Grant execute to authenticated and anon (needed during auth callback)
GRANT EXECUTE ON FUNCTION check_email_allowed(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_email_allowed(TEXT) TO anon;

-- ============================================================================
-- UPDATE CLAIM FUNCTION TO USE ALLOWED EMAILS
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_profile_by_email(
    p_user_id UUID,
    p_user_email TEXT
)
RETURNS TABLE (
    claimed_profile_id UUID,
    profile_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id UUID;
    v_profile_name TEXT;
BEGIN
    -- Find profile that allows this email
    SELECT pae.profile_id, p.display_name
    INTO v_profile_id, v_profile_name
    FROM profile_allowed_emails pae
    JOIN profiles p ON p.id = pae.profile_id
    WHERE pae.email = p_user_email
    LIMIT 1;

    -- If found, create/update access
    IF v_profile_id IS NOT NULL THEN
        -- Create user_access entry
        INSERT INTO user_access (user_id, profile_id, access_level, granted_by)
        VALUES (p_user_id, v_profile_id, 'viewer', p_user_id)
        ON CONFLICT (user_id, profile_id) DO NOTHING;

        RETURN QUERY SELECT v_profile_id, v_profile_name;
    END IF;

    RETURN;
END;
$$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE profile_allowed_emails ENABLE ROW LEVEL SECURITY;

-- Only allow reading allowed emails for profiles user has access to
CREATE POLICY "Users can view allowed emails for their profiles"
    ON profile_allowed_emails FOR SELECT
    USING (
        profile_id IN (
            SELECT profile_id FROM user_access WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- MIGRATE EXISTING owner_email DATA (if any)
-- ============================================================================
INSERT INTO profile_allowed_emails (profile_id, email)
SELECT id, owner_email
FROM profiles
WHERE owner_email IS NOT NULL
ON CONFLICT (email) DO NOTHING;
