-- User Profile Claiming Migration
-- Migration: user_profile_claiming
--
-- Adds support for users to claim existing profiles based on email matching.
-- When a user logs in for the first time, we check if their email matches
-- any profile's owner_email. If so, we associate the profile with their user ID.

-- ============================================================================
-- ADD OWNER_EMAIL TO PROFILES
-- This allows matching incoming users to existing profiles before they have
-- a Supabase user ID
-- ============================================================================
ALTER TABLE profiles
ADD COLUMN owner_email TEXT;

-- Index for looking up profiles by owner email (for claiming)
CREATE INDEX idx_profiles_owner_email ON profiles(owner_email);

-- ============================================================================
-- FUNCTION TO CLAIM PROFILE
-- Called after OAuth login to associate profile with authenticated user
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
SECURITY DEFINER -- Run with elevated privileges to bypass RLS
AS $$
DECLARE
    v_profile_id UUID;
    v_profile_name TEXT;
BEGIN
    -- Find unclaimed profile matching this email
    SELECT id, display_name INTO v_profile_id, v_profile_name
    FROM profiles
    WHERE owner_email = p_user_email
    AND owner_user_id IS NULL
    LIMIT 1;

    -- If found, claim it
    IF v_profile_id IS NOT NULL THEN
        -- Update profile ownership
        UPDATE profiles
        SET owner_user_id = p_user_id,
            updated_at = NOW()
        WHERE id = v_profile_id;

        -- Create user_access entry with 'owner' level
        INSERT INTO user_access (user_id, profile_id, access_level, granted_by)
        VALUES (p_user_id, v_profile_id, 'owner', p_user_id)
        ON CONFLICT (user_id, profile_id) DO UPDATE
        SET access_level = 'owner';

        RETURN QUERY SELECT v_profile_id, v_profile_name;
    END IF;

    -- Return empty result if no profile to claim
    RETURN;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION claim_profile_by_email(UUID, TEXT) TO authenticated;

-- ============================================================================
-- POLICY UPDATE: Allow users to claim unclaimed profiles
-- ============================================================================

-- Allow users to update unclaimed profiles that match their email
CREATE POLICY "Users can claim profiles by email"
    ON profiles FOR UPDATE
    USING (
        owner_user_id IS NULL
        AND owner_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
