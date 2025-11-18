import { createHash } from "crypto";
import { pool } from "../db/pool.js";
import { CreateVisitorPayload, Visitor } from "../types/visitor.js";
import { v4 as uuidv4 } from "uuid";

interface LedgerEntry {
  hash: string;
  visitorId: number;
  createdAt: string;
}

const inMemoryLedger: LedgerEntry[] = [];

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
  recordLedgerEntry(visitor);
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
    recordLedgerEntry(visitor);
  }
  return visitor;
}

export async function deleteVisitor(id: number): Promise<void> {
  await pool.query("DELETE FROM visitors WHERE id = $1", [id]);
}

export function getLedger(): LedgerEntry[] {
  return inMemoryLedger;
}

function recordLedgerEntry(visitor: Visitor): void {
  const payload = JSON.stringify({
    id: visitor.id,
    status: visitor.status,
    qrToken: visitor.qrToken,
    timestamp: new Date().toISOString(),
  });

  const hash = createHash("sha256").update(payload).digest("hex");
  inMemoryLedger.push({
    hash,
    visitorId: visitor.id,
    createdAt: new Date().toISOString(),
  });
}
