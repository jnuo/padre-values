-- Neon Schema for ViziAI (cleaned from Supabase migrations)
-- Removes: RLS policies, auth.users references, Supabase-specific functions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean re-import)
DROP TABLE IF EXISTS metric_aliases CASCADE;
DROP TABLE IF EXISTS processed_files CASCADE;
DROP TABLE IF EXISTS profile_allowed_emails CASCADE;
DROP TABLE IF EXISTS metric_definitions CASCADE;
DROP TABLE IF EXISTS metrics CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS user_access CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name TEXT NOT NULL,
    owner_user_id UUID,  -- No FK to auth.users in Neon
    owner_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_owner ON profiles(owner_user_id);

-- User access table
CREATE TABLE user_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,  -- No FK to auth.users in Neon
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('viewer', 'editor', 'owner')),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by UUID,
    UNIQUE(user_id, profile_id)
);

CREATE INDEX idx_user_access_user ON user_access(user_id);
CREATE INDEX idx_user_access_profile ON user_access(profile_id);

-- Reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sample_date DATE NOT NULL,
    file_name TEXT,
    source TEXT DEFAULT 'pdf',
    content_hash TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, sample_date)
);

CREATE INDEX idx_reports_profile ON reports(profile_id);
CREATE INDEX idx_reports_sample_date ON reports(sample_date);
CREATE INDEX idx_reports_profile_date ON reports(profile_id, sample_date DESC);
CREATE INDEX idx_reports_content_hash ON reports(content_hash);

-- Metrics table
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
    UNIQUE(report_id, name)
);

CREATE INDEX idx_metrics_report ON metrics(report_id);
CREATE INDEX idx_metrics_name ON metrics(name);
CREATE INDEX idx_metrics_report_name ON metrics(report_id, name);

-- Metric definitions table
CREATE TABLE metric_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT,
    ref_low NUMERIC,
    ref_high NUMERIC,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, name)
);

CREATE INDEX idx_metric_definitions_profile ON metric_definitions(profile_id);
CREATE INDEX idx_metric_definitions_profile_order ON metric_definitions(profile_id, display_order);

-- Profile allowed emails table
CREATE TABLE profile_allowed_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profile_allowed_emails_email ON profile_allowed_emails(email);

-- Metric aliases table
CREATE TABLE metric_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_id UUID REFERENCES metric_definitions(id) ON DELETE CASCADE,
    alias TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metric_aliases_alias ON metric_aliases(alias);

-- Processed files table (for duplicate detection)
CREATE TABLE processed_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    file_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, content_hash)
);

CREATE INDEX idx_processed_files_hash ON processed_files(content_hash);

-- Updated_at trigger function
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

CREATE TRIGGER update_metric_definitions_updated_at
    BEFORE UPDATE ON metric_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
