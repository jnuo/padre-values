-- Create processed_files table to track all processed PDF hashes
-- This solves the issue where multiple PDFs share the same sample_date

CREATE TABLE processed_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, content_hash)
);

-- Index for fast hash lookups
CREATE INDEX idx_processed_files_hash ON processed_files(content_hash);

-- RLS policies (match existing tables)
ALTER TABLE processed_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view processed files for profiles they have access to"
    ON processed_files FOR SELECT
    USING (
        profile_id IN (
            SELECT profile_id FROM user_access WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage processed_files"
    ON processed_files FOR ALL
    USING (auth.role() = 'service_role');

-- Migrate existing content_hash values from reports table
INSERT INTO processed_files (profile_id, content_hash, file_name, created_at)
SELECT profile_id, content_hash, file_name, created_at
FROM reports
WHERE content_hash IS NOT NULL
ON CONFLICT (profile_id, content_hash) DO NOTHING;
