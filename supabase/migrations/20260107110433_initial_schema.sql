-- ViziAI Initial Schema
-- Migration: initial_schema
--
-- Tables:
-- - profiles: Patient profiles being tracked
-- - user_access: Many-to-many relationship between auth.users and profiles
-- - reports: One per PDF/sample date, belongs to a profile
-- - metrics: Individual test values with reference ranges, belongs to a report

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- Represents a patient whose blood tests are being tracked
-- ============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name TEXT NOT NULL,
    -- Optional: placeholder for claiming by a real user later
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up profiles by owner
CREATE INDEX idx_profiles_owner ON profiles(owner_user_id);

-- ============================================================================
-- USER_ACCESS TABLE
-- Controls which users can view which profiles (many-to-many)
-- This enables family members to view the same patient's data
-- ============================================================================
CREATE TABLE user_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('viewer', 'editor', 'owner')),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Each user can only have one access entry per profile
    UNIQUE(user_id, profile_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_user_access_user ON user_access(user_id);
CREATE INDEX idx_user_access_profile ON user_access(profile_id);

-- ============================================================================
-- REPORTS TABLE
-- One report per PDF/blood test date, belongs to a profile
-- ============================================================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sample_date DATE NOT NULL,
    file_name TEXT,
    source TEXT DEFAULT 'pdf', -- 'pdf', 'manual', 'migrated'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate reports for same profile/date
    UNIQUE(profile_id, sample_date)
);

-- Indexes for common queries
CREATE INDEX idx_reports_profile ON reports(profile_id);
CREATE INDEX idx_reports_sample_date ON reports(sample_date);
CREATE INDEX idx_reports_profile_date ON reports(profile_id, sample_date DESC);

-- ============================================================================
-- METRICS TABLE
-- Individual test values with reference ranges
-- Stores each metric from a blood test report
-- ============================================================================
CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value NUMERIC NOT NULL,
    unit TEXT,
    ref_low NUMERIC,
    ref_high NUMERIC,
    flag TEXT CHECK (flag IN ('H', 'L', 'N', NULL)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each metric name should only appear once per report
    UNIQUE(report_id, name)
);

-- Indexes for efficient queries
CREATE INDEX idx_metrics_report ON metrics(report_id);
CREATE INDEX idx_metrics_name ON metrics(name);
CREATE INDEX idx_metrics_report_name ON metrics(report_id, name);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can view profiles they have access to
CREATE POLICY "Users can view accessible profiles"
    ON profiles FOR SELECT
    USING (
        id IN (
            SELECT profile_id FROM user_access WHERE user_id = auth.uid()
        )
        OR owner_user_id = auth.uid()
    );

-- PROFILES: Only owners can update their profiles
CREATE POLICY "Owners can update profiles"
    ON profiles FOR UPDATE
    USING (owner_user_id = auth.uid());

-- PROFILES: Authenticated users can create profiles
CREATE POLICY "Authenticated users can create profiles"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- USER_ACCESS: Users can view their own access entries
CREATE POLICY "Users can view own access"
    ON user_access FOR SELECT
    USING (user_id = auth.uid());

-- USER_ACCESS: Profile owners can manage access
CREATE POLICY "Profile owners can manage access"
    ON user_access FOR ALL
    USING (
        profile_id IN (
            SELECT id FROM profiles WHERE owner_user_id = auth.uid()
        )
    );

-- REPORTS: Users can view reports for profiles they have access to
CREATE POLICY "Users can view accessible reports"
    ON reports FOR SELECT
    USING (
        profile_id IN (
            SELECT profile_id FROM user_access WHERE user_id = auth.uid()
        )
        OR profile_id IN (
            SELECT id FROM profiles WHERE owner_user_id = auth.uid()
        )
    );

-- REPORTS: Users with editor/owner access can manage reports
CREATE POLICY "Editors can manage reports"
    ON reports FOR ALL
    USING (
        profile_id IN (
            SELECT profile_id FROM user_access
            WHERE user_id = auth.uid()
            AND access_level IN ('editor', 'owner')
        )
        OR profile_id IN (
            SELECT id FROM profiles WHERE owner_user_id = auth.uid()
        )
    );

-- METRICS: Users can view metrics for accessible reports
CREATE POLICY "Users can view accessible metrics"
    ON metrics FOR SELECT
    USING (
        report_id IN (
            SELECT r.id FROM reports r
            JOIN user_access ua ON r.profile_id = ua.profile_id
            WHERE ua.user_id = auth.uid()
        )
        OR report_id IN (
            SELECT r.id FROM reports r
            JOIN profiles p ON r.profile_id = p.id
            WHERE p.owner_user_id = auth.uid()
        )
    );

-- METRICS: Editors can manage metrics
CREATE POLICY "Editors can manage metrics"
    ON metrics FOR ALL
    USING (
        report_id IN (
            SELECT r.id FROM reports r
            JOIN user_access ua ON r.profile_id = ua.profile_id
            WHERE ua.user_id = auth.uid()
            AND ua.access_level IN ('editor', 'owner')
        )
        OR report_id IN (
            SELECT r.id FROM reports r
            JOIN profiles p ON r.profile_id = p.id
            WHERE p.owner_user_id = auth.uid()
        )
    );

-- ============================================================================
-- UPDATED_AT TRIGGER
-- Automatically update updated_at timestamp on row changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SERVICE ROLE BYPASS
-- Allow service role to bypass RLS for server-side operations
-- ============================================================================

-- Create a policy that allows service role full access
-- This is necessary for Python backend to insert data without user auth
CREATE POLICY "Service role has full access to profiles"
    ON profiles FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to user_access"
    ON user_access FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to reports"
    ON reports FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to metrics"
    ON metrics FOR ALL
    USING (auth.role() = 'service_role');
