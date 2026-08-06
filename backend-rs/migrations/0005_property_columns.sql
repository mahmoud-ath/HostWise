-- HostWise v0.7.0: extend properties with investment/planning fields
-- aligned with the frontend Property type.

ALTER TABLE properties ADD COLUMN max_guests INTEGER NOT NULL DEFAULT 2;
ALTER TABLE properties ADD COLUMN square_meters REAL;
ALTER TABLE properties ADD COLUMN acquisition_cost REAL;
ALTER TABLE properties ADD COLUMN monthly_mortgage REAL;
ALTER TABLE properties ADD COLUMN target_occupancy REAL;
ALTER TABLE properties ADD COLUMN target_annual_revenue REAL;
ALTER TABLE properties ADD COLUMN notes TEXT;
