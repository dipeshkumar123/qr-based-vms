import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const REQUIRED_TABLES = [
  'visitors',
  'audit_ledger',
  'analytics_events',
  'verification_logs',
  'schema_meta',
  'analytics_events_archive',
  'audit_ledger_archive',
];

async function assertTableExists(client, table) {
  const r = await client.query('SELECT to_regclass($1) as exists', [`public.${table}`]);
  if (!r.rows[0]?.exists) {
    throw new Error(`missing table: ${table}`);
  }
}

async function assertSchemaVersionReadable(client) {
  const r = await client.query("SELECT value FROM schema_meta WHERE key = 'schema_version'");
  if (!r.rows[0]?.value) {
    throw new Error('schema version missing');
  }
}

async function runTypedInsertRollbackProbe(client) {
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO analytics_events (name, event_type, visitor_id, event_time, payload)
       VALUES ($1, $2, $3, NOW(), $4::jsonb)`,
      ['migration_smoke_probe', 'migration_smoke_probe', null, JSON.stringify({ probe: true })]
    );

    const r = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM analytics_events
       WHERE event_type = 'migration_smoke_probe'`
    );

    if (!Number.isFinite(Number(r.rows[0]?.count))) {
      throw new Error('typed probe query failed');
    }
  } finally {
    await client.query('ROLLBACK');
  }
}

async function runRetentionReadProbe(client) {
  await client.query(`SELECT COUNT(*)::int FROM analytics_events WHERE created_at < NOW() - INTERVAL '90 days'`);
  await client.query(`SELECT COUNT(*)::int FROM audit_ledger WHERE created_at < NOW() - INTERVAL '365 days'`);
}

async function smokeTest() {
  const client = await pool.connect();
  try {
    console.log('Running migration smoke tests...');

    for (const table of REQUIRED_TABLES) {
      await assertTableExists(client, table);
      console.log(`✓ table exists: ${table}`);
    }

    await assertSchemaVersionReadable(client);
    console.log('✓ schema version readable');

    await runTypedInsertRollbackProbe(client);
    console.log('✓ typed analytics insert probe passed (rollback)');

    await runRetentionReadProbe(client);
    console.log('✓ retention read probes passed');

    console.log('Migration smoke tests completed successfully');
  } catch (error) {
    console.error('Migration smoke tests failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

smokeTest();
