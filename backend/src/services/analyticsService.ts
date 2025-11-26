import { pool } from "../db/pool.js";

// In-memory fallback if table missing
const memoryEvents: { name: string; payload: any; createdAt: string }[] = [];

export async function recordEvent(name: string, payload: any): Promise<void> {
  const createdAt = new Date().toISOString();
  try {
    await pool.query(
      `INSERT INTO analytics_events (name, payload, created_at) VALUES ($1, $2, NOW())`,
      [name, JSON.stringify(payload ?? null)]
    );
  } catch (e: any) {
    // Fallback to memory store (likely table absent); keep bounded size
    memoryEvents.push({ name, payload, createdAt });
    if (memoryEvents.length > 500) memoryEvents.shift();
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
