import { pool } from "../db/pool.js";
import { logger } from "../utils/logger.js";

// Known event names — accepted names for analytics events
const KNOWN_EVENTS = new Set([
  "visitor_registered",
  "visitor_check_in",
  "visitor_check_out",
  "visitor_face_captured",
  "visitor_face_capture_failed",
  "visitor_face_verified",
  "visitor_face_verify_failed",
  "visitor_deleted",
  "admin_login",
  "admin_logout",
  "qr_scanned",
  "notification_sent",
  "notification_failed",
]);

// In-memory fallback if table missing — bounded and logged
const memoryEvents: { name: string; payload: any; createdAt: string }[] = [];
const MAX_MEMORY_EVENTS = 500;

// Health tracking for analytics ingestion
let memoryBufferedEvents = 0;
let consecutiveDbFailures = 0;
let dbInsertFailures = 0;
let memoryFallbackCount = 0;
let memoryFlushRecovered = 0;
let breakerOpen = false;

export async function recordEvent(name: string, payload: any): Promise<void> {
  // Warn on unknown event names (but still record them)
  if (!KNOWN_EVENTS.has(name)) {
    logger.warn({ eventName: name }, "Recording unknown analytics event name");
  }

  const createdAt = new Date().toISOString();
  try {
    // Pass payload directly as JSONB (no need to JSON.stringify for JSONB columns)
    await pool.query(
      `INSERT INTO analytics_events (name, payload, created_at) VALUES ($1, $2::jsonb, NOW())`,
      [name, payload != null ? JSON.stringify(payload) : null]
    );
    consecutiveDbFailures = 0;
    memoryFlushRecovered++;
  } catch (e: any) {
    consecutiveDbFailures++;
    dbInsertFailures++;
    // Fallback to memory store (likely table absent); keep bounded size
    logger.warn({ err: e, eventName: name }, "Analytics DB insert failed, falling back to memory store");
    memoryEvents.push({ name, payload, createdAt });
    if (memoryEvents.length > MAX_MEMORY_EVENTS) {
      memoryEvents.shift();
      memoryFallbackCount++;
    }
    if (memoryEvents.length > 0) {
      memoryBufferedEvents = memoryEvents.length;
    }
  }
}

export async function listRecentEvents(limit = 100): Promise<{ name: string; payload: any; createdAt: string }[]> {
  try {
    const result = await pool.query(
      `SELECT name, payload, created_at as "createdAt" FROM analytics_events ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(r => ({ name: r.name, payload: r.payload, createdAt: r.createdAt }));
  } catch {
    return memoryEvents.slice(-limit).reverse();
  }
}

/**
 * Get event counts grouped by name for a time range.
 * Useful for the analytics dashboard summary.
 */
export async function getEventCounts(days = 30): Promise<Record<string, number>> {
  try {
    const result = await pool.query(
      `SELECT name, COUNT(*)::int as count
       FROM analytics_events
       WHERE created_at >= NOW() - make_interval(days => $1)
       GROUP BY name
       ORDER BY count DESC`,
      [days]
    );
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.name] = row.count;
    }
    return counts;
  } catch {
    // Count from memory store
    const counts: Record<string, number> = {};
    for (const evt of memoryEvents) {
      counts[evt.name] = (counts[evt.name] || 0) + 1;
    }
    return counts;
  }
}

/**
 * Get current health state of analytics ingestion.
 * Used by analyticsAlertService for reliability monitoring.
 */
export function getIngestHealth(): {
  breakerOpen: boolean;
  memoryBufferedEvents: number;
  consecutiveDbFailures: number;
  dbInsertFailures: number;
  memoryFallbackCount: number;
  memoryFlushRecovered: number;
} {
  return {
    breakerOpen,
    memoryBufferedEvents,
    consecutiveDbFailures,
    dbInsertFailures,
    memoryFallbackCount,
    memoryFlushRecovered,
  };
}

export function setBreakerOpen(open: boolean): void {
  breakerOpen = open;
}