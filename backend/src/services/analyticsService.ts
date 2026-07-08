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
const MAX_PAYLOAD_CHARS = 64_000;
let dbInsertFailures = 0;
let consecutiveDbFailures = 0;
let memoryFallbackCount = 0;
let memoryFlushRecovered = 0;
let breakerOpen = false;

function extractVisitorId(payload: any): number | null {
  const raw = payload?.visitor_id;
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

function normalizePayload(payload: any): any {
  if (payload == null) return null;
  if (typeof payload !== "object") {
    return { value: String(payload).slice(0, 2000) };
  }

  const cloned = { ...payload } as Record<string, any>;
  const visitorId = extractVisitorId(cloned);
  if (visitorId != null) cloned.visitor_id = visitorId;
  else if ("visitor_id" in cloned) delete cloned.visitor_id;

  const serialized = JSON.stringify(cloned);
  if (serialized.length > MAX_PAYLOAD_CHARS) {
    return {
      truncated: true,
      original_size: serialized.length,
      preview: serialized.slice(0, MAX_PAYLOAD_CHARS),
    };
  }
  return cloned;
}

export async function recordEvent(name: string, payload: any): Promise<void> {
  // Warn on unknown event names (but still record them)
  if (!KNOWN_EVENTS.has(name)) {
    logger.warn({ eventName: name }, "Recording unknown analytics event name");
  }

  const createdAt = new Date().toISOString();
  const sanitizedPayload = normalizePayload(payload);
  const visitorId = extractVisitorId(sanitizedPayload);
  try {
    // Persist typed fields for fast querying while keeping raw payload as JSONB.
    await pool.query(
      `INSERT INTO analytics_events (name, event_type, visitor_id, event_time, payload, created_at)
       VALUES ($1, $2, $3, NOW(), $4::jsonb, NOW())`,
      [name, name, visitorId, sanitizedPayload != null ? JSON.stringify(sanitizedPayload) : null]
    );
    if (consecutiveDbFailures > 0) {
      memoryFlushRecovered += 1;
    }
    consecutiveDbFailures = 0;
    breakerOpen = false;
  } catch (e: any) {
    dbInsertFailures += 1;
    consecutiveDbFailures += 1;
    memoryFallbackCount += 1;
    breakerOpen = consecutiveDbFailures >= 3;
    // Fallback to memory store (likely table absent); keep bounded size
    logger.warn({ err: e, eventName: name }, "Analytics DB insert failed, falling back to memory store");
    memoryEvents.push({ name, payload: sanitizedPayload, createdAt });
    if (memoryEvents.length > MAX_MEMORY_EVENTS) memoryEvents.shift();
  }
}

export function getIngestHealth() {
  return {
    breakerOpen,
    memoryBufferedEvents: memoryEvents.length,
    consecutiveDbFailures,
    dbInsertFailures,
    memoryFallbackCount,
    memoryFlushRecovered,
  };
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
