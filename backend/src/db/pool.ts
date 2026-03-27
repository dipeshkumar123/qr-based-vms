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
