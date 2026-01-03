import { createHash } from "crypto";
import { pool } from "../db/pool.js";
import { CreateVisitorPayload, Visitor } from "../types/visitor.js";
import { v4 as uuidv4 } from "uuid";
import { HttpError } from "../utils/httpError.js";
import { notifyVisitorArrival } from "./notificationService.js";

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
  
  // Send notification about new visitor registration
  notifyVisitorArrival({
    name: visitor.name,
    email: visitor.email,
    phone: visitor.phone,
    purpose: visitor.purpose,
  }).catch((error) => {
    console.error('Failed to send arrival notification:', error);
  });

  return visitor;
}

export interface ListVisitorsOptions {
  page?: number;
  limit?: number;
  query?: string;
  status?: Visitor["status"] | "all";
}

export async function listVisitors(options: ListVisitorsOptions = {}): Promise<{ items: Visitor[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const offset = (page - 1) * limit;
  const where: string[] = [];
  const params: any[] = [];

  if (options.status && options.status !== "all") {
    params.push(options.status);
    where.push(`status = $${params.length}`);
  }
  if (options.query && options.query.trim()) {
    const q = `%${options.query.trim().toLowerCase()}%`;
    params.push(q, q, q);
    where.push(`(LOWER(name) LIKE $${params.length - 2} OR LOWER(email) LIKE $${params.length - 1} OR phone LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `SELECT COUNT(*)::int as total FROM visitors ${whereSql}`;
  const listSql = `SELECT id, name, email, phone, purpose, status, qr_token as "qrToken", 
            checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
            created_at as "createdAt", updated_at as "updatedAt",
            CASE WHEN EXISTS (
              SELECT 1 FROM analytics_events ae
              WHERE (ae.payload->>'visitor_id')::int = visitors.id
              AND ae.name = 'visitor_face_captured'
            ) THEN true ELSE false END as "biometricEnrolled"
     FROM visitors
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}`;

  const [countResult, listResult] = await Promise.all([
    pool.query(countSql, params),
    pool.query(listSql, params),
  ]);

  return { items: listResult.rows as Visitor[], total: countResult.rows[0].total as number, page, limit };
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
    throw new HttpError(409, 'Visitor is already checked in.');
  }

  // If this visit was already checked out, block re-check-in on the same record
  if (existingVisitor.status === 'checked_out') {
    throw new HttpError(409, 'This visit is already completed. Please register a new visit.');
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
    throw new HttpError(409, 'Visitor has not checked in yet.');
  }

  if (existingVisitor.status === 'checked_out') {
    throw new HttpError(409, 'Visitor is already checked out.');
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

export async function getLedger(page = 1, limit = 100): Promise<{ items: LedgerEntry[]; total: number; page: number; limit: number }> {
  const safeLimit = Math.min(200, Math.max(1, limit));
  const offset = (Math.max(1, page) - 1) * safeLimit;
  const [count, list] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int as total FROM audit_ledger`),
    pool.query(
      `SELECT visitor_id as "visitorId", hash, created_at as "createdAt"
       FROM audit_ledger
       ORDER BY created_at DESC
       LIMIT ${safeLimit} OFFSET ${offset}`
    ),
  ]);
  return { items: list.rows as LedgerEntry[], total: count.rows[0].total as number, page: Math.max(1, page), limit: safeLimit };
}

export async function verifyLedgerLinks(): Promise<{ ok: boolean; issues: Array<{ visitorId: number; index: number; message: string }> }> {
  // Verify that for each visitor, prev_hash chains to previous hash
  // Note: we cannot recompute the hash content, only verify link consistency
  try {
    const res = await pool.query(
      `SELECT visitor_id, hash, COALESCE(prev_hash,'') as prev_hash, created_at
       FROM audit_ledger
       ORDER BY visitor_id ASC, created_at ASC, id ASC`
    );
    const issues: Array<{ visitorId: number; index: number; message: string }> = [];
    let currentVisitor: number | null = null;
    let lastHash: string | null = null;
    let idx = -1;
    for (const row of res.rows) {
      const vId = row.visitor_id as number;
      if (currentVisitor !== vId) {
        currentVisitor = vId;
        lastHash = null;
        idx = 0;
      } else {
        idx += 1;
      }
      const prev = row.prev_hash as string;
      if ((lastHash ?? "") !== (prev ?? "")) {
        issues.push({ visitorId: vId, index: idx, message: "prev_hash does not match previous hash" });
      }
      lastHash = row.hash as string;
    }
    return { ok: issues.length === 0, issues };
  } catch (e) {
    return { ok: false, issues: [{ visitorId: -1, index: -1, message: (e as any)?.message || "verification failed" }] };
  }
}

export interface AuditReport {
  ok: boolean;
  totalEntries: number;
  chainIntegrity: { ok: boolean; issues: Array<{ visitorId: number; index: number; message: string }> };
  visitorsSuspicious: Array<{ visitorId: number; entryCount: number; tamperedEntries: number }>;
  lastVerified: string;
}

export async function generateAuditReport(): Promise<AuditReport> {
  try {
    // Get total count
    const countRes = await pool.query(`SELECT COUNT(*)::int as total FROM audit_ledger`);
    const totalEntries = countRes.rows[0]?.total || 0;

    // Verify chain integrity
    const chainIntegrity = await verifyLedgerLinks();

    // Get suspicious visitors (those with broken chains)
    const suspiciousRes = await pool.query(`
      SELECT 
        al.visitor_id,
        COUNT(*)::int as entry_count,
        SUM(CASE WHEN COALESCE(al.prev_hash,'') != COALESCE(
          LAG(al.hash) OVER (PARTITION BY al.visitor_id ORDER BY al.created_at)
        , '') THEN 1 ELSE 0 END)::int as tampered_count
      FROM audit_ledger al
      GROUP BY al.visitor_id
      HAVING SUM(CASE WHEN COALESCE(al.prev_hash,'') != COALESCE(
        LAG(al.hash) OVER (PARTITION BY al.visitor_id ORDER BY al.created_at)
      , '') THEN 1 ELSE 0 END) > 0
    `);

    const visitorsSuspicious = suspiciousRes.rows.map(row => ({
      visitorId: row.visitor_id as number,
      entryCount: row.entry_count as number,
      tamperedEntries: row.tampered_count as number,
    }));

    return {
      ok: chainIntegrity.ok && visitorsSuspicious.length === 0,
      totalEntries,
      chainIntegrity,
      visitorsSuspicious,
      lastVerified: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      totalEntries: 0,
      chainIntegrity: { ok: false, issues: [{ visitorId: -1, index: -1, message: (e as any)?.message || "report generation failed" }] },
      visitorsSuspicious: [],
      lastVerified: new Date().toISOString(),
    };
  }
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
