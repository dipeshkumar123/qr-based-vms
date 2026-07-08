-- ────────────────────────────────────────────────────────────────
-- II-VMS Database Schema
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS visitors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  host TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'checked_in', 'checked_out')),
  qr_token TEXT NOT NULL UNIQUE,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  biometric_verified BOOLEAN NOT NULL DEFAULT FALSE,
  biometric_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update the updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_visitors_updated_at ON visitors;
CREATE TRIGGER update_visitors_updated_at
  BEFORE UPDATE ON visitors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Audit ledger uses RESTRICT to preserve audit trail on visitor delete
CREATE TABLE IF NOT EXISTS audit_ledger (
  id SERIAL PRIMARY KEY,
  visitor_id INTEGER NOT NULL REFERENCES visitors(id) ON DELETE RESTRICT,
  hash TEXT NOT NULL,
  prev_hash TEXT,
  action TEXT NOT NULL DEFAULT 'UNKNOWN',
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'success',
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  change_set JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_ledger_archive (
  id SERIAL PRIMARY KEY,
  original_id INTEGER NOT NULL UNIQUE,
  visitor_id INTEGER,
  hash TEXT NOT NULL,
  prev_hash TEXT,
  action TEXT NOT NULL DEFAULT 'UNKNOWN',
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'success',
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  change_set JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  event_type TEXT,
  visitor_id INTEGER,
  event_time TIMESTAMPTZ,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events_archive (
  id SERIAL PRIMARY KEY,
  original_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  event_type TEXT,
  visitor_id INTEGER,
  event_time TIMESTAMPTZ,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Verification logs for biometric audit trail
CREATE TABLE IF NOT EXISTS verification_logs (
  id SERIAL PRIMARY KEY,
  visitor_id INTEGER REFERENCES visitors(id) ON DELETE SET NULL,
  is_match BOOLEAN NOT NULL,
  confidence_score REAL NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schema metadata for runtime compatibility checks
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_meta (key, value)
VALUES ('schema_version', '2026.04.05.1')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_email ON visitors(email);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_visitor ON audit_ledger(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_action ON audit_ledger(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_actor ON audit_ledger(actor_type, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_outcome ON audit_ledger(outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id_typed ON analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_time ON analytics_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
-- Functional index for efficient visitor_id extraction from JSONB payload
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id
  ON analytics_events (((payload->>'visitor_id')::int))
  WHERE payload->>'visitor_id' ~ '^[0-9]+$';
CREATE INDEX IF NOT EXISTS idx_verification_logs_visitor ON verification_logs(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_archive_created ON analytics_events_archive(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_archive_created ON audit_ledger_archive(created_at DESC);
