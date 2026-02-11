-- Tracking Measurements Migration
-- Adds manual health tracking for blood pressure (tansiyon) and weight (kilo)
--
-- Usage: Users can log daily measurements per profile

CREATE TABLE tracking_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('blood_pressure', 'weight')),
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Blood pressure fields (required when type = 'blood_pressure')
    systolic INT,
    diastolic INT,
    pulse INT,

    -- Weight field (required when type = 'weight')
    weight_kg DECIMAL(5,2),

    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure BP entries have systolic + diastolic
ALTER TABLE tracking_measurements ADD CONSTRAINT chk_bp_fields
    CHECK (type != 'blood_pressure' OR (systolic IS NOT NULL AND diastolic IS NOT NULL));

-- Ensure weight entries have weight_kg
ALTER TABLE tracking_measurements ADD CONSTRAINT chk_weight_fields
    CHECK (type != 'weight' OR weight_kg IS NOT NULL);

-- Indexes for common queries
CREATE INDEX idx_tracking_profile_type ON tracking_measurements(profile_id, type);
CREATE INDEX idx_tracking_measured_at ON tracking_measurements(profile_id, measured_at DESC);
