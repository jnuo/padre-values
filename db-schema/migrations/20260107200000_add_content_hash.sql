-- Add content_hash column to reports table for duplicate detection
-- This stores MD5 hash of PDF content to skip already-processed files

ALTER TABLE reports
ADD COLUMN content_hash TEXT;

-- Create index for fast lookup
CREATE INDEX idx_reports_content_hash ON reports(content_hash);

-- Add comment explaining the column
COMMENT ON COLUMN reports.content_hash IS 'MD5 hash of PDF file content for duplicate detection';
