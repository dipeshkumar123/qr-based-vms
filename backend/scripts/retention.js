import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const RETENTION_ANALYTICS_DAYS = Number(process.env.RETENTION_ANALYTICS_DAYS || '90');
const RETENTION_AUDIT_DAYS = Number(process.env.RETENTION_AUDIT_DAYS || '365');
const RETENTION_BATCH_SIZE = Number(process.env.RETENTION_BATCH_SIZE || '1000');

async function archiveAnalyticsEvents(client) {
  const sql = `
    WITH moved AS (
      DELETE FROM analytics_events
      WHERE id IN (
        SELECT id
        FROM analytics_events
        WHERE created_at < NOW() - make_interval(days => $1)
        ORDER BY id
        LIMIT $2
      )
      RETURNING id, name, event_type, visitor_id, event_time, payload, created_at
    )
    INSERT INTO analytics_events_archive (
      original_id, name, event_type, visitor_id, event_time, payload, created_at, archived_at
    )
    SELECT id, name, event_type, visitor_id, event_time, payload, created_at, NOW()
    FROM moved
    ON CONFLICT (original_id) DO NOTHING
    RETURNING 1
  `;

  const result = await client.query(sql, [RETENTION_ANALYTICS_DAYS, RETENTION_BATCH_SIZE]);
  return result.rowCount || 0;
}

async function archiveAuditLedger(client) {
  const sql = `
    WITH moved AS (
      DELETE FROM audit_ledger
      WHERE id IN (
        SELECT id
        FROM audit_ledger
        WHERE created_at < NOW() - make_interval(days => $1)
        ORDER BY id
        LIMIT $2
      )
      RETURNING id, visitor_id, hash, prev_hash, created_at
    )
    INSERT INTO audit_ledger_archive (
      original_id, visitor_id, hash, prev_hash, created_at, archived_at
    )
    SELECT id, visitor_id, hash, prev_hash, created_at, NOW()
    FROM moved
    ON CONFLICT (original_id) DO NOTHING
    RETURNING 1
  `;

  const result = await client.query(sql, [RETENTION_AUDIT_DAYS, RETENTION_BATCH_SIZE]);
  return result.rowCount || 0;
}

async function runRetention() {
  const client = await pool.connect();
  let analyticsTotal = 0;
  let auditTotal = 0;

  try {
    console.log('Running retention archival process...');
    console.log(`analytics retention days=${RETENTION_ANALYTICS_DAYS}`);
    console.log(`audit retention days=${RETENTION_AUDIT_DAYS}`);
    console.log(`batch size=${RETENTION_BATCH_SIZE}`);

    while (true) {
      await client.query('BEGIN');
      const moved = await archiveAnalyticsEvents(client);
      await client.query('COMMIT');
      analyticsTotal += moved;
      if (moved < RETENTION_BATCH_SIZE) break;
    }

    while (true) {
      await client.query('BEGIN');
      const moved = await archiveAuditLedger(client);
      await client.query('COMMIT');
      auditTotal += moved;
      if (moved < RETENTION_BATCH_SIZE) break;
    }

    console.log(`Archived analytics events: ${analyticsTotal}`);
    console.log(`Archived audit ledger rows: ${auditTotal}`);
    console.log('Retention archival completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Retention archival failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runRetention();
