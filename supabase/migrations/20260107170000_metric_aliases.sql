-- Metric Aliases Migration
--
-- Creates a lookup table for metric name aliases.
-- When parsing new PDFs, the system checks if a metric name is an alias
-- and maps it to the canonical metric_id instead of creating a new one.

-- ============================================================================
-- CREATE METRIC ALIASES TABLE
-- ============================================================================
CREATE TABLE metric_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
    alias TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast alias lookups
CREATE INDEX idx_metric_aliases_alias ON metric_aliases(alias);
CREATE INDEX idx_metric_aliases_metric ON metric_aliases(metric_id);

-- ============================================================================
-- FUNCTION TO GET CANONICAL METRIC ID FROM NAME
-- Returns metric_id if name matches a metric or an alias, NULL otherwise
-- ============================================================================
CREATE OR REPLACE FUNCTION get_canonical_metric_id(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_metric_id UUID;
BEGIN
    -- First, check if it's an exact match to a metric name
    SELECT id INTO v_metric_id
    FROM metric_definitions
    WHERE LOWER(name) = LOWER(p_name)
    LIMIT 1;

    IF v_metric_id IS NOT NULL THEN
        RETURN v_metric_id;
    END IF;

    -- Then, check if it's an alias
    SELECT metric_id INTO v_metric_id
    FROM metric_aliases
    WHERE LOWER(alias) = LOWER(p_name)
    LIMIT 1;

    RETURN v_metric_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_canonical_metric_id(TEXT) TO authenticated;

-- ============================================================================
-- INSERT KNOWN ALIASES
-- These are the duplicate names we just merged, preserved for future use
-- ============================================================================

-- Ürik Asit (Uric Acid)
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('1cde9949-1f05-4ee8-95d6-6f246d76889e', 'Ürik Asit (Serum/Plazma)');

-- Albumin
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('0ea676a7-18af-478a-9a21-5399acd3e51b', 'Albümin'),
    ('0ea676a7-18af-478a-9a21-5399acd3e51b', 'Albümin (Serum/Plazma)');

-- Alkalen Fosfataz (ALP)
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('0736d576-37b3-4e3c-ab78-1d07ce027456', 'Alkalen fosfataz (Serum/Plazma)'),
    ('0736d576-37b3-4e3c-ab78-1d07ce027456', 'Alkalin fosfataz'),
    ('0736d576-37b3-4e3c-ab78-1d07ce027456', 'Alp (Alkalen Fosfataz)'),
    ('0736d576-37b3-4e3c-ab78-1d07ce027456', 'ALP');

-- AST (Aspartat Transaminaz)
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('5516aa0b-bd40-4405-b551-119aa9932b41', 'Aspartat transaminaz [Ast / Sgot]'),
    ('5516aa0b-bd40-4405-b551-119aa9932b41', 'Ast (Aspartat Transaminaz)'),
    ('5516aa0b-bd40-4405-b551-119aa9932b41', 'AST'),
    ('5516aa0b-bd40-4405-b551-119aa9932b41', 'SGOT');

-- ALT (Alanin Aminotransferaz)
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('0e3ce7c3-2a78-4130-8c28-fdfbe56a43ab', 'Alanin aminotransferaz - [Alt / Sgpt]'),
    ('0e3ce7c3-2a78-4130-8c28-fdfbe56a43ab', 'Alt (Alanin Aminotransferaz)'),
    ('0e3ce7c3-2a78-4130-8c28-fdfbe56a43ab', 'Alt (Alanine Aminotransferaz)'),
    ('0e3ce7c3-2a78-4130-8c28-fdfbe56a43ab', 'ALT'),
    ('0e3ce7c3-2a78-4130-8c28-fdfbe56a43ab', 'SGPT');

-- Bilirubin (Total)
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('5183a39a-3da8-454c-9fba-2b4039d805bd', 'Bilirubin'),
    ('5183a39a-3da8-454c-9fba-2b4039d805bd', 'Total Bilirubin'),
    ('5183a39a-3da8-454c-9fba-2b4039d805bd', 'T.Bil');

-- Bilirubin (Direkt)
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('dd0f465b-1ab5-48e8-9372-9ef9a8954a69', 'Bilirubin - [Direkt]'),
    ('dd0f465b-1ab5-48e8-9372-9ef9a8954a69', 'Bilirubin Direkt'),
    ('dd0f465b-1ab5-48e8-9372-9ef9a8954a69', 'Direkt Bilirubin'),
    ('dd0f465b-1ab5-48e8-9372-9ef9a8954a69', 'D.Bil');

-- GGT
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('82c9c06f-c7ed-4c97-9bab-28e48b6f3c8e', 'Ggt (Gamma Glutamil Transferaz)'),
    ('82c9c06f-c7ed-4c97-9bab-28e48b6f3c8e', 'GGT'),
    ('82c9c06f-c7ed-4c97-9bab-28e48b6f3c8e', 'Gamma GT');

-- Potasyum
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('67304e90-3912-45e7-b64e-62eb64390310', 'Potasiyum'),
    ('67304e90-3912-45e7-b64e-62eb64390310', 'POTASYUM (SERUM/PLAZMA)'),
    ('67304e90-3912-45e7-b64e-62eb64390310', 'K+');

-- Sodyum
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('1c58fd5b-1b19-4cb4-9eda-8af6aaa3e31c', 'Sodyum (Na)(Serum/Plazma)'),
    ('1c58fd5b-1b19-4cb4-9eda-8af6aaa3e31c', 'Sodyum [Na]'),
    ('1c58fd5b-1b19-4cb4-9eda-8af6aaa3e31c', 'Na+');

-- Kalsiyum
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('be8901a3-51de-4d5c-b2e9-79a6c6f5e1c1', 'Kalsiyum (Ca)'),
    ('be8901a3-51de-4d5c-b2e9-79a6c6f5e1c1', 'Kalsiyum (Serum/Plazma)'),
    ('be8901a3-51de-4d5c-b2e9-79a6c6f5e1c1', 'Ca');

-- Demir
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('17abc5c6-7210-4ea4-ad04-5f88396d6161', 'Demir [Serum]'),
    ('17abc5c6-7210-4ea4-ad04-5f88396d6161', 'Fe');

-- Ferritin
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('25ecc42f-7378-44f0-bdea-7c1856e9ffcb', 'Ferritin(Serum/Plazma)');

-- LDH
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('cb20f2e3-3032-4eae-9b91-d82934639eab', 'Ldh (Laktik Dehidrogenaz)'),
    ('cb20f2e3-3032-4eae-9b91-d82934639eab', 'LDH');

-- eGFR
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('03f6081a-b68a-4fc6-a17d-eb8eff1692c4', 'Gfr - Tahmini Glomerüler Filtrasyon Hızı'),
    ('03f6081a-b68a-4fc6-a17d-eb8eff1692c4', 'GFR');

-- RET (count)
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('9a75be21-d0af-4057-a62a-ee796d6ddc1a', 'RET #'),
    ('9a75be21-d0af-4057-a62a-ee796d6ddc1a', 'Retikülosit');

-- RET%
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('2b03616d-6135-46d6-8c69-55fa5ea094d0', 'RET%');

-- MPV
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('e555701f-10db-4c48-9678-cc5b0b0eb97c', 'Ortalama Trombosit Hacmi');

-- Total Protein
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('37665019-0d14-4025-937c-60cee0fa12d3', 'Total Protein');

-- Doymuş Demir Bağlama Kapasitesi
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('c743cc5c-cf41-44c9-94d1-49033b4d5f8b', 'Doymuş Demir bağlama kapasitesi');

-- Gap K
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('7cdefb19-5aa4-4be9-9147-9250e35bdbf5', 'Gap_K');

-- Protrombin zamanı INR
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('0424f6f8-bc77-4495-b5f2-a405a4302cc5', 'Protrombin zamanı INR'),
    ('0424f6f8-bc77-4495-b5f2-a405a4302cc5', 'PT INR'),
    ('0424f6f8-bc77-4495-b5f2-a405a4302cc5', 'INR');

-- Protrombin zamanı %
INSERT INTO metric_aliases (metric_id, alias) VALUES
    ('a8041527-94a0-4289-8549-e70023857f31', 'Protrombin zamanı %'),
    ('a8041527-94a0-4289-8549-e70023857f31', 'PT %');

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE metric_aliases ENABLE ROW LEVEL SECURITY;

-- Allow reading all aliases (public)
CREATE POLICY "Anyone can view metric aliases"
    ON metric_aliases FOR SELECT
    USING (true);
