import { createHash } from "crypto";
import { pool } from "../db/pool.js";
import { CreateVisitorPayload, Visitor } from "../types/visitor.js";
import { v4 as uuidv4 } from "uuid";

type LedgerEvent = "created" | "checked_in" | "checked_out" | "deleted";

export interface LedgerEntry {
  hash: string;
  visitorId: number;
  createdAt: string;
}

export async function createVisitor(payload: CreateVisitorPayload): Promise<Visitor> {
  const qrToken = uuidv4();
  const status: Visitor["status"] = "registered";

  const result = await pool.query(
    `INSERT INTO visitors (name, email, phone, purpose, status, qr_token)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, phone, purpose, status, qr_token as "qrToken", 
               checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
               created_at as "createdAt", updated_at as "updatedAt"`,
    [payload.name, payload.email, payload.phone, payload.purpose, status, qrToken]
  );

  const visitor = result.rows[0] as Visitor;
  await recordLedgerEntry(visitor, "created");
  return visitor;
}

export async function listVisitors(): Promise<Visitor[]> {
  const result = await pool.query(
    `SELECT id, name, email, phone, purpose, status, qr_token as "qrToken", 
            checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM visitors
     ORDER BY created_at DESC`
  );
  return result.rows as Visitor[];
}

export async function findVisitorByQrToken(qrToken: string): Promise<Visitor | null> {
  const result = await pool.query(
    `SELECT id, name, email, phone, purpose, status, qr_token as "qrToken", 
            checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM visitors
     WHERE qr_token = $1`
  , [qrToken]);

  return (result.rows[0] as Visitor) ?? null;
}

export async function checkInVisitor(qrToken: string): Promise<Visitor | null> {
  // First check if visitor exists and their current status
  const checkResult = await pool.query(
    `SELECT id, name, email, phone, purpose, status, qr_token as "qrToken", 
            checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM visitors
     WHERE qr_token = $1`,
    [qrToken]
  );

  const existingVisitor = checkResult.rows[0] as Visitor;
  
  if (!existingVisitor) {
    return null;
  }

  // If already checked in (and not checked out), throw an error
  if (existingVisitor.status === 'checked_in') {
    throw new Error('Visitor is already checked in. Please check out first.');
  }

  // If checked out, allow re-entry (new visit)
  if (existingVisitor.status === 'checked_out') {
    // This is a return visit - allow check-in again
  }

  // Update status to checked_in
  const result = await pool.query(
    `UPDATE visitors
     SET status = 'checked_in', checked_in_at = NOW(), updated_at = NOW()
     WHERE qr_token = $1
     RETURNING id, name, email, phone, purpose, status, qr_token as "qrToken", 
               checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
               created_at as "createdAt", updated_at as "updatedAt"`
  , [qrToken]);

  const visitor = (result.rows[0] as Visitor) ?? null;
  if (visitor) {
    await recordLedgerEntry(visitor, "checked_in");
  }
  return visitor;
}

export async function checkOutVisitor(qrToken: string): Promise<Visitor | null> {
  // First check if visitor exists and their current status
  const checkResult = await pool.query(
    `SELECT id, name, email, phone, purpose, status, qr_token as "qrToken", 
            checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM visitors
     WHERE qr_token = $1`,
    [qrToken]
  );

  const existingVisitor = checkResult.rows[0] as Visitor;
  
  if (!existingVisitor) {
    return null;
  }

  // Only allow check-out if currently checked in
  if (existingVisitor.status === 'registered') {
    throw new Error('Visitor has not checked in yet.');
  }

  if (existingVisitor.status === 'checked_out') {
    throw new Error('Visitor is already checked out.');
  }

  // Update status to checked_out
  const result = await pool.query(
    `UPDATE visitors
     SET status = 'checked_out', checked_out_at = NOW(), updated_at = NOW()
     WHERE qr_token = $1
     RETURNING id, name, email, phone, purpose, status, qr_token as "qrToken", 
               checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
               created_at as "createdAt", updated_at as "updatedAt"`
  , [qrToken]);

  const visitor = (result.rows[0] as Visitor) ?? null;
  if (visitor) {
    await recordLedgerEntry(visitor, "checked_out");
  }
  return visitor;
}

export async function deleteVisitor(id: number): Promise<void> {
  const visitorResult = await pool.query<Visitor>(
    `SELECT id, name, email, phone, purpose, status, qr_token as "qrToken", 
            checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM visitors
     WHERE id = $1`,
    [id]
  );

  const visitor = visitorResult.rows[0];
  if (!visitor) {
    return;
  }

  await recordLedgerEntry(visitor, "deleted");

  await pool.query(
    `DELETE FROM visitors
     WHERE id = $1`,
    [id]
  );
}

export async function getLedger(): Promise<LedgerEntry[]> {
  const result = await pool.query(
    `SELECT visitor_id as "visitorId", hash, created_at as "createdAt"
     FROM audit_ledger
     ORDER BY created_at DESC
     LIMIT 200`
  );
  return result.rows as LedgerEntry[];
}

async function recordLedgerEntry(visitor: Visitor, event: LedgerEvent): Promise<void> {
  const payload = JSON.stringify({
    id: visitor.id,
    status: visitor.status,
    qrToken: visitor.qrToken,
    event,
    timestamp: new Date().toISOString(),
  });

  // Fetch previous hash (last inserted) to build chain for tamper resistance
  let prevHash: string | null = null;
  try {
    const prevResult = await pool.query(
      `SELECT hash FROM audit_ledger WHERE visitor_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [visitor.id]
    );
    prevHash = prevResult.rows[0]?.hash ?? null;
  } catch {
    // Ignore; table may not exist yet or query fails
  }

  const chainPayload = JSON.stringify({ prevHash, current: payload });
  const hash = createHash("sha256").update(chainPayload).digest("hex");

  // Attempt to insert with prev_hash column first; fallback if column missing
  try {
    await pool.query(
      `INSERT INTO audit_ledger (visitor_id, hash, prev_hash)
       VALUES ($1, $2, $3)`,
      [visitor.id, hash, prevHash]
    );
  } catch {
    await pool.query(
      `INSERT INTO audit_ledger (visitor_id, hash)
       VALUES ($1, $2)`,
      [visitor.id, hash]
    );
  }
}
