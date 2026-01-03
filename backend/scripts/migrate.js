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

    // Audit ledger prev_hash
    await client.query(`ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS prev_hash TEXT;`);
    console.log('✓ audit_ledger.prev_hash ensured');

    // Analytics events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ analytics_events table ensured');

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_ledger_visitor ON audit_ledger(visitor_id, created_at DESC);`);
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
