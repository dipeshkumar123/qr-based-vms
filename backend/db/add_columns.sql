-- Add timestamp columns for check-in/check-out tracking
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
