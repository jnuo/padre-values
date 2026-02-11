-- Profile Sharing & Family Access Management Migration
-- Migration: profile_sharing
--
-- Changes:
-- 1. Alter profile_allowed_emails: drop UNIQUE(email), add UNIQUE(email, profile_id)
-- 2. Create profile_invites table for shareable invite links

-- ============================================================================
-- ALTER PROFILE_ALLOWED_EMAILS
-- Allow same email to be associated with multiple profiles
-- ============================================================================

-- Drop old unique constraint on email only
ALTER TABLE profile_allowed_emails DROP CONSTRAINT IF EXISTS profile_allowed_emails_email_key;

-- Add new unique constraint on (email, profile_id)
ALTER TABLE profile_allowed_emails ADD CONSTRAINT profile_allowed_emails_email_profile_unique UNIQUE (email, profile_id);

-- ============================================================================
-- PROFILE_INVITES TABLE
-- Tracks invitations sent by profile owners to share access
-- ============================================================================
CREATE TABLE profile_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    access_level TEXT NOT NULL CHECK (access_level IN ('viewer', 'editor')),
    token TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'revoked')),
    claimed_at TIMESTAMPTZ,
    claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

-- Partial unique index: only one pending invite per email per profile
CREATE UNIQUE INDEX idx_profile_invites_pending
    ON profile_invites (profile_id, LOWER(email))
    WHERE status = 'pending';

-- Indexes for common lookups (token already indexed via UNIQUE constraint)
CREATE INDEX idx_profile_invites_profile ON profile_invites(profile_id);
CREATE INDEX idx_profile_invites_email ON profile_invites(LOWER(email));
CREATE INDEX idx_profile_invites_status ON profile_invites(status);
