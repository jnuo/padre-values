-- Rename metric_definitions → metric_preferences
-- Drop unit, ref_low, ref_high columns (refs live in metrics table per reading)
-- Keep only display_order, is_favorite (actual preferences)

BEGIN;

-- Rename the table
ALTER TABLE metric_definitions RENAME TO metric_preferences;

-- Drop columns that don't belong in preferences
ALTER TABLE metric_preferences DROP COLUMN IF EXISTS unit;
ALTER TABLE metric_preferences DROP COLUMN IF EXISTS ref_low;
ALTER TABLE metric_preferences DROP COLUMN IF EXISTS ref_high;

-- Rename indexes to match new table name
ALTER INDEX IF EXISTS idx_metric_definitions_profile RENAME TO idx_metric_preferences_profile;
ALTER INDEX IF EXISTS idx_metric_definitions_profile_order RENAME TO idx_metric_preferences_profile_order;

COMMIT;
