import { createHash } from "crypto";
import { pool } from "../db/pool.js";
import { CreateVisitorPayload, Visitor } from "../types/visitor.js";
import { v4 as uuidv4 } from "uuid";

type LedgerEvent = "created" | "checked_in" | "deleted";

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
     RETURNING id, name, email, phone, purpose, status, qr_token as "qrToken", created_at as "createdAt", updated_at as "updatedAt"`,
    [payload.name, payload.email, payload.phone, payload.purpose, status, qrToken]
  );

  const visitor = result.rows[0] as Visitor;
  await recordLedgerEntry(visitor, "created");
  return visitor;
}

export async function listVisitors(): Promise<Visitor[]> {
  const result = await pool.query(
    `SELECT id, name, email, phone, purpose, status, qr_token as "qrToken", created_at as "createdAt", updated_at as "updatedAt"
     FROM visitors
     ORDER BY created_at DESC`
  );
  return result.rows as Visitor[];
}

export async function findVisitorByQrToken(qrToken: string): Promise<Visitor | null> {
  const result = await pool.query(
    `SELECT id, name, email, phone, purpose, status, qr_token as "qrToken", created_at as "createdAt", updated_at as "updatedAt"
     FROM visitors
     WHERE qr_token = $1`
  , [qrToken]);

  return (result.rows[0] as Visitor) ?? null;
}

export async function checkInVisitor(qrToken: string): Promise<Visitor | null> {
  const result = await pool.query(
    `UPDATE visitors
     SET status = 'checked_in', updated_at = NOW()
     WHERE qr_token = $1
     RETURNING id, name, email, phone, purpose, status, qr_token as "qrToken", created_at as "createdAt", updated_at as "updatedAt"`
  , [qrToken]);

  const visitor = (result.rows[0] as Visitor) ?? null;
  if (visitor) {
    await recordLedgerEntry(visitor, "checked_in");
  }
  return visitor;
}

export async function deleteVisitor(id: number): Promise<void> {
  const result = await pool.query<Visitor>(
    `DELETE FROM visitors
     WHERE id = $1
     RETURNING id, name, email, phone, purpose, status, qr_token as "qrToken", created_at as "createdAt", updated_at as "updatedAt"`,
    [id]
  );

  const deletedVisitor = result.rows[0];
  if (deletedVisitor) {
    await recordLedgerEntry(deletedVisitor, "deleted");
  }
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

  const hash = createHash("sha256").update(payload).digest("hex");
  await pool.query(
    `INSERT INTO audit_ledger (visitor_id, hash)
     VALUES ($1, $2)`,
    [visitor.id, hash]
  );
}
