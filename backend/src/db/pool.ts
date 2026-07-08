import pg from "pg";
import { dbConfig } from "../config.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: dbConfig.connectionString,
  max: dbConfig.poolMax,
  idleTimeoutMillis: dbConfig.idleTimeoutMs,
  connectionTimeoutMillis: dbConfig.connectionTimeoutMs,
});

// Set statement_timeout on each new connection (Pool-level config doesn't work for this)
pool.on("connect", (client) => {
  client.query(`SET statement_timeout = ${dbConfig.statementTimeoutMs}`).catch((err) => {
    logger.warn({ err }, "Failed to set statement_timeout on connection");
  });
});

// Handle idle client errors to prevent process crashes
pool.on("error", (err) => {
  logger.error({ err }, "Unexpected idle client error in database pool");
});

const originalQuery = pool.query.bind(pool);

// Instrument all DB calls for latency visibility and slow-query diagnostics.
(pool as any).query = async (...args: any[]) => {
  const startedAt = Date.now();
  try {
    const result = await (originalQuery as any)(...args);
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= dbConfig.slowQueryMs) {
      logger.warn(
        {
          elapsedMs,
          slowQueryMs: dbConfig.slowQueryMs,
          rowCount: result?.rowCount,
          query: typeof args[0] === "string" ? args[0].slice(0, 180) : "[query-object]",
        },
        "Slow database query detected"
      );
    }
    return result;
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    logger.error(
      {
        err,
        elapsedMs,
        query: typeof args[0] === "string" ? args[0].slice(0, 180) : "[query-object]",
      },
      "Database query failed"
    );
    throw err;
  }
};

/**
 * Ensure the database is reachable, with retry logic for container orchestration.
 */
export async function ensureDatabaseConnection(
  retries = dbConfig.retryAttempts,
  delayMs = dbConfig.retryDelayMs
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      if (attempt > 1) {
        logger.info(`Database connected after ${attempt} attempts`);
      }
      return;
    } catch (error) {
      logger.warn({ err: error, attempt, retries }, `Database connection attempt ${attempt}/${retries} failed`);
      if (attempt === retries) {
        logger.error({ err: error }, "Database connection failed after all retries");
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function validateDatabaseSchema(): Promise<{ ok: boolean; missing: string[] }> {
  const requiredTables = [
    "visitors",
    "audit_ledger",
    "analytics_events",
    "verification_logs",
  ];

  const requiredColumns: Array<{ table: string; column: string }> = [
    { table: "visitors", column: "id" },
    { table: "visitors", column: "qr_token" },
    { table: "visitors", column: "status" },
    { table: "visitors", column: "biometric_verified" },
    { table: "analytics_events", column: "name" },
    { table: "analytics_events", column: "payload" },
    { table: "verification_logs", column: "visitor_id" },
  ];

  const missing: string[] = [];

  for (const table of requiredTables) {
    const tableRes = await pool.query<{ exists: string | null }>(
      `SELECT to_regclass($1) as exists`,
      [`public.${table}`]
    );
    if (!tableRes.rows[0]?.exists) {
      missing.push(`table:${table}`);
    }
  }

  for (const { table, column } of requiredColumns) {
    const colRes = await pool.query<{ found: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
       ) as found`,
      [table, column]
    );
    if (!colRes.rows[0]?.found) {
      missing.push(`column:${table}.${column}`);
    }
  }

  try {
    const versionRes = await pool.query<{ value: string }>(
      `SELECT value FROM schema_meta WHERE key = 'schema_version'`
    );
    const currentVersion = versionRes.rows[0]?.value;
    if (!currentVersion) {
      missing.push("schema_version:missing");
    } else if (currentVersion !== dbConfig.requiredSchemaVersion) {
      missing.push(`schema_version:mismatch(current=${currentVersion}, required=${dbConfig.requiredSchemaVersion})`);
    }
  } catch {
    missing.push("schema_version:unreadable");
  }

  return { ok: missing.length === 0, missing };
}
