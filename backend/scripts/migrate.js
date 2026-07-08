import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running database migration...');
    // Visitors timestamps
    await client.query(`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;`);
    console.log('✓ visitors.checked_in_at ensured');
    await client.query(`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;`);
    console.log('✓ visitors.checked_out_at ensured');
    await client.query(`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS biometric_verified BOOLEAN NOT NULL DEFAULT FALSE;`);
    console.log('✓ visitors.biometric_verified ensured');
    await client.query(`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS biometric_verified_at TIMESTAMPTZ;`);
    console.log('✓ visitors.biometric_verified_at ensured');

    // Audit ledger prev_hash
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS prev_hash TEXT;`);
    console.log('✓ audit_ledger.prev_hash ensured');
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'UNKNOWN';`);
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS actor_type TEXT NOT NULL DEFAULT 'system';`);
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS actor_id TEXT;`);
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS target_type TEXT;`);
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS target_id TEXT;`);
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'success';`);
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS request_id TEXT;`);
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS ip_address TEXT;`);
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS user_agent TEXT;`);
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS change_set JSONB;`);
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`);
    console.log('✓ audit_ledger metadata columns ensured');

    // Analytics events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        event_type TEXT,
        visitor_id INTEGER,
        event_time TIMESTAMPTZ,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ analytics_events table ensured');

    await client.query(`
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
      )
    `);
    await client.query(`
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
      )
    `);
    console.log('✓ archive tables ensured');

    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'UNKNOWN';`);
    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS actor_type TEXT NOT NULL DEFAULT 'system';`);
    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS actor_id TEXT;`);
    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS target_type TEXT;`);
    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS target_id TEXT;`);
    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'success';`);
    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS request_id TEXT;`);
    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS ip_address TEXT;`);
    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS user_agent TEXT;`);
    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS change_set JSONB;`);
    await client.query(`ALTER TABLE audit_ledger_archive ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`);
    console.log('✓ audit_ledger_archive metadata columns ensured');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      INSERT INTO schema_meta (key, value)
      VALUES ('schema_version', '2026.04.05.1')
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);
    console.log('✓ schema_meta version ensured');

    await client.query(`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS event_type TEXT;`);
    await client.query(`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS visitor_id INTEGER;`);
    await client.query(`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS event_time TIMESTAMPTZ;`);
    await client.query(`UPDATE analytics_events SET event_type = name WHERE event_type IS NULL;`);
    await client.query(`
      UPDATE analytics_events
      SET visitor_id = CASE
        WHEN payload->>'visitor_id' ~ '^[0-9]+$' THEN (payload->>'visitor_id')::int
        ELSE NULL
      END
      WHERE visitor_id IS NULL
    `);
    await client.query(`UPDATE analytics_events SET event_time = created_at WHERE event_time IS NULL;`);
    console.log('✓ analytics_events typed columns ensured/backfilled');

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_ledger_visitor ON audit_ledger(visitor_id, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_ledger_action ON audit_ledger(action, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_ledger_actor ON audit_ledger(actor_type, actor_id, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_ledger_outcome ON audit_ledger(outcome, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(name);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id_typed ON analytics_events(visitor_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_event_time ON analytics_events(event_time DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_archive_created ON analytics_events_archive(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_ledger_archive_created ON audit_ledger_archive(created_at DESC);`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id
      ON analytics_events (((payload->>'visitor_id')::int))
      WHERE payload->>'visitor_id' ~ '^[0-9]+$'
    `);
    console.log('✓ helpful indexes ensured');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
