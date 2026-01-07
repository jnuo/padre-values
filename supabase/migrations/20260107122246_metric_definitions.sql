-- ============================================================================
-- METRIC_DEFINITIONS TABLE
-- Stores canonical metric metadata: reference values, display order, favorites
-- Separates metric configuration from individual test values
-- ============================================================================

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

    -- Each metric name should only appear once per profile
    UNIQUE(profile_id, name)
);

-- Indexes for efficient queries
CREATE INDEX idx_metric_definitions_profile ON metric_definitions(profile_id);
CREATE INDEX idx_metric_definitions_profile_order ON metric_definitions(profile_id, display_order);

-- Enable RLS
ALTER TABLE metric_definitions ENABLE ROW LEVEL SECURITY;

-- Users can view metric definitions for profiles they have access to
CREATE POLICY "Users can view accessible metric definitions"
    ON metric_definitions FOR SELECT
    USING (
        profile_id IN (
            SELECT profile_id FROM user_access WHERE user_id = auth.uid()
        )
        OR profile_id IN (
            SELECT id FROM profiles WHERE owner_user_id = auth.uid()
        )
    );

-- Editors can manage metric definitions
CREATE POLICY "Editors can manage metric definitions"
    ON metric_definitions FOR ALL
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

-- Service role has full access for Python backend operations
CREATE POLICY "Service role has full access to metric_definitions"
    ON metric_definitions FOR ALL
    USING (auth.role() = 'service_role');

-- Add updated_at trigger
CREATE TRIGGER update_metric_definitions_updated_at
    BEFORE UPDATE ON metric_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
