-- Add notified_at to user_access for tracking new-profile notifications
ALTER TABLE user_access ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- Backfill: mark all existing rows as already notified
UPDATE user_access SET notified_at = granted_at WHERE notified_at IS NULL;
