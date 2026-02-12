-- Restructure metric_aliases to be global (text alias → text canonical_name)
-- Old schema: alias → metric_preferences.id (per-profile, FK)
-- New schema: alias → canonical_name (global, plain text)

BEGIN;

-- Drop old FK and column
ALTER TABLE metric_aliases DROP CONSTRAINT IF EXISTS metric_aliases_metric_id_fkey;
ALTER TABLE metric_aliases DROP COLUMN IF EXISTS metric_id;

-- Add canonical_name column
ALTER TABLE metric_aliases ADD COLUMN canonical_name TEXT NOT NULL DEFAULT '';

-- Remove the default after adding
ALTER TABLE metric_aliases ALTER COLUMN canonical_name DROP DEFAULT;

-- Insert Potasyum aliases
INSERT INTO metric_aliases (alias, canonical_name) VALUES
  ('Potasiyum', 'Potasyum'),
  ('POTASYUM (SERUM/PLAZMA)', 'Potasyum'),
  ('Potaszyum', 'Potasyum');

COMMIT;
