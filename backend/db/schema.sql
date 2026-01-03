CREATE TABLE IF NOT EXISTS visitors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered',
  qr_token TEXT NOT NULL UNIQUE,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if they don't exist (for existing databases)
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS audit_ledger (
  id SERIAL PRIMARY KEY,
  visitor_id INTEGER NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  prev_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_visitor ON audit_ledger(visitor_id, created_at DESC);
