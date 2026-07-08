import { createHash } from "crypto";
import { pool } from "../db/pool.js";
import { CreateVisitorPayload, Visitor } from "../types/visitor.js";
import { v4 as uuidv4 } from "uuid";
import { HttpError } from "../utils/httpError.js";
import { notifyVisitorArrival } from "./notificationService.js";
import { logger } from "../utils/logger.js";

export interface AuditContext {
  actorType?: string;
  actorId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LedgerFilters {
  action?: string;
  actorType?: string;
  actorId?: string;
  outcome?: string;
  visitorId?: number;
  from?: string;
  to?: string;
}

interface RecordLedgerOptions {
  action: string;
  context?: AuditContext;
  targetType?: string;
  targetId?: string;
  outcome?: "success" | "failure";
  changeSet?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// Shared column list to avoid repetition
const VISITOR_COLUMNS = `id, name, email, phone, purpose, status, qr_token as "qrToken", 
            checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
            created_at as "createdAt", updated_at as "updatedAt"`;

export interface LedgerEntry {
  id: number;
  hash: string;
  prevHash: string | null;
  visitorId: number;
  action: string;
  actorType: string;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  outcome: string;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  changeSet: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function createVisitor(payload: CreateVisitorPayload, auditContext?: AuditContext): Promise<Visitor> {
  const qrToken = uuidv4();
  const status: Visitor["status"] = "registered";

  // Use a transaction to ensure visitor + ledger entry are atomic
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO visitors (name, email, phone, purpose, status, qr_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${VISITOR_COLUMNS}`,
      [payload.name, payload.email, payload.phone, payload.purpose, status, qrToken]
    );

    const visitor = result.rows[0] as Visitor;

    // Record ledger entry within the same transaction
    await recordLedgerEntryWithClient(client, visitor, {
      action: "VISITOR_CREATED",
      context: auditContext,
      targetType: "visitor",
      targetId: String(visitor.id),
      outcome: "success",
      metadata: {
        status: visitor.status,
      },
    });

    await client.query("COMMIT");

    // Send notification about new visitor registration (fire-and-forget after commit)
    notifyVisitorArrival({
      name: visitor.name,
      email: visitor.email,
      phone: visitor.phone,
      purpose: visitor.purpose,
    }).catch((error) => {
      logger.error({ err: error }, "Failed to send arrival notification");
    });

    return visitor;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findVisitorById(id: number): Promise<Visitor | null> {
  const result = await pool.query(
    `SELECT ${VISITOR_COLUMNS} FROM visitors WHERE id = $1`,
    [id]
  );
  return (result.rows[0] as Visitor) ?? null;
}

export interface UpdateVisitorPayload {
  name?: string;
  email?: string;
  phone?: string;
  purpose?: string;
}

export async function updateVisitor(id: number, payload: UpdateVisitorPayload, auditContext?: AuditContext): Promise<Visitor | null> {
  const beforeVisitor = await findVisitorById(id);
  if (!beforeVisitor) {
    return null;
  }

  const setClauses: string[] = [];
  const params: any[] = [];

  if (payload.name !== undefined) {
    params.push(payload.name);
    setClauses.push(`name = $${params.length}`);
  }
  if (payload.email !== undefined) {
    params.push(payload.email);
    setClauses.push(`email = $${params.length}`);
  }
  if (payload.phone !== undefined) {
    params.push(payload.phone);
    setClauses.push(`phone = $${params.length}`);
  }
  if (payload.purpose !== undefined) {
    params.push(payload.purpose);
    setClauses.push(`purpose = $${params.length}`);
  }

  if (setClauses.length === 0) {
    return beforeVisitor;
  }

  setClauses.push("updated_at = NOW()");
  params.push(id);

  const result = await pool.query(
    `UPDATE visitors SET ${setClauses.join(", ")} WHERE id = $${params.length}
     RETURNING ${VISITOR_COLUMNS}`,
    params
  );

  const visitor = (result.rows[0] as Visitor) ?? null;
  if (visitor) {
    await recordLedgerEntry(visitor, {
      action: "VISITOR_UPDATED",
      context: auditContext,
      targetType: "visitor",
      targetId: String(visitor.id),
      outcome: "success",
      changeSet: {
        before: {
          name: beforeVisitor.name,
          email: beforeVisitor.email,
          phone: beforeVisitor.phone,
          purpose: beforeVisitor.purpose,
        },
        after: {
          name: visitor.name,
          email: visitor.email,
          phone: visitor.phone,
          purpose: visitor.purpose,
        },
      },
      metadata: {
        updatedFields: Object.keys(payload),
      },
    });
  }
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

  const visitorColsRes = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'visitors'`
  );
  const visitorCols = new Set(visitorColsRes.rows.map((r) => r.column_name));
  const hasBiometricVerifiedCol = visitorCols.has('biometric_verified');
  const hasBiometricVerifiedAtCol = visitorCols.has('biometric_verified_at');

  // Older databases may have verification_logs with different column names.
  const verificationColsRes = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_logs'`
  );
  const verificationCols = new Set(verificationColsRes.rows.map((r) => r.column_name));

  let biometricVerifiedSql = hasBiometricVerifiedCol
    ? `COALESCE(visitors.biometric_verified, false) as "biometricVerified"`
    : `CASE WHEN EXISTS (
        SELECT 1 FROM analytics_events ae
        WHERE (ae.payload->>'visitor_id') ~ '^[0-9]+$'
        AND (ae.payload->>'visitor_id')::int = visitors.id
        AND ae.name = 'visitor_face_verified'
        AND COALESCE(LOWER(ae.payload->>'is_match'), 'false') = 'true'
      ) THEN true ELSE false END as "biometricVerified"`;
  const biometricVerifiedAtSql = hasBiometricVerifiedAtCol
    ? `visitors.biometric_verified_at as "biometricVerifiedAt"`
    : `NULL::timestamptz as "biometricVerifiedAt"`;
  const visitorCol = verificationCols.has("visitor_id")
    ? 'vl.visitor_id'
    : verificationCols.has("visitorId")
    ? 'vl."visitorId"'
    : null;
  const matchCol = verificationCols.has("is_match")
    ? 'vl.is_match'
    : verificationCols.has("isMatch")
    ? 'vl."isMatch"'
    : null;

  if (!hasBiometricVerifiedCol && visitorCol && matchCol) {
    biometricVerifiedSql = `CASE WHEN (
        EXISTS (
          SELECT 1 FROM analytics_events ae
          WHERE (ae.payload->>'visitor_id') ~ '^[0-9]+$'
          AND (ae.payload->>'visitor_id')::int = visitors.id
          AND ae.name = 'visitor_face_verified'
          AND COALESCE(LOWER(ae.payload->>'is_match'), 'false') = 'true'
        )
        OR EXISTS (
          SELECT 1 FROM verification_logs vl
          WHERE ${visitorCol} = visitors.id
          AND ${matchCol} = true
        )
      ) THEN true ELSE false END as "biometricVerified"`;
  }

  const countSql = `SELECT COUNT(*)::int as total FROM visitors ${whereSql}`;
  const listSql = `SELECT id, name, email, phone, purpose, status, qr_token as "qrToken", 
            checked_in_at as "checkedInAt", checked_out_at as "checkedOutAt",
            created_at as "createdAt", updated_at as "updatedAt",
            ${biometricVerifiedAtSql},
            CASE WHEN EXISTS (
              SELECT 1 FROM analytics_events ae
              WHERE (ae.payload->>'visitor_id') ~ '^[0-9]+$'
              AND (ae.payload->>'visitor_id')::int = visitors.id
              AND ae.name = 'visitor_face_captured'
            ) THEN true ELSE false END as "biometricEnrolled",
            ${biometricVerifiedSql}
     FROM visitors
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  const [countResult, listResult] = await Promise.all([
    pool.query(countSql, params),
    pool.query(listSql, [...params, limit, offset]),
  ]);

  return { items: listResult.rows as Visitor[], total: countResult.rows[0].total as number, page, limit };
}

export async function findVisitorByQrToken(qrToken: string): Promise<Visitor | null> {
  const result = await pool.query(
    `SELECT ${VISITOR_COLUMNS} FROM visitors WHERE qr_token = $1`,
    [qrToken]
  );

  return (result.rows[0] as Visitor) ?? null;
}

export async function checkInVisitor(qrToken: string, auditContext?: AuditContext): Promise<Visitor | null> {
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
    await recordLedgerEntry(visitor, {
      action: "VISITOR_CHECKED_IN",
      context: auditContext,
      targetType: "visitor",
      targetId: String(visitor.id),
      outcome: "success",
      changeSet: {
        before: { status: existingVisitor.status, checkedInAt: existingVisitor.checkedInAt ?? null },
        after: { status: visitor.status, checkedInAt: visitor.checkedInAt ?? null },
      },
    });
  }
  return visitor;
}

export async function checkOutVisitor(qrToken: string, auditContext?: AuditContext): Promise<Visitor | null> {
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
    await recordLedgerEntry(visitor, {
      action: "VISITOR_CHECKED_OUT",
      context: auditContext,
      targetType: "visitor",
      targetId: String(visitor.id),
      outcome: "success",
      changeSet: {
        before: { status: existingVisitor.status, checkedOutAt: existingVisitor.checkedOutAt ?? null },
        after: { status: visitor.status, checkedOutAt: visitor.checkedOutAt ?? null },
      },
    });
  }
  return visitor;
}

export async function deleteVisitor(id: number, auditContext?: AuditContext): Promise<boolean> {
  const visitorResult = await pool.query<Visitor>(
    `SELECT ${VISITOR_COLUMNS} FROM visitors WHERE id = $1`,
    [id]
  );

  const visitor = visitorResult.rows[0];
  if (!visitor) {
    return false;
  }

  await recordLedgerEntry(visitor, {
    action: "VISITOR_DELETED",
    context: auditContext,
    targetType: "visitor",
    targetId: String(visitor.id),
    outcome: "success",
    changeSet: {
      before: {
        name: visitor.name,
        email: visitor.email,
        phone: visitor.phone,
        purpose: visitor.purpose,
        status: visitor.status,
      },
      after: null,
    },
  });

  await pool.query(
    `DELETE FROM visitors WHERE id = $1`,
    [id]
  );
  return true;
}

export async function getLedger(
  page = 1,
  limit = 100,
  filters: LedgerFilters = {}
): Promise<{ items: LedgerEntry[]; total: number; page: number; limit: number }> {
  const safeLimit = Math.min(200, Math.max(1, limit));
  const offset = (Math.max(1, page) - 1) * safeLimit;

  const ledgerColsRes = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'audit_ledger'`
  );
  const cols = new Set(ledgerColsRes.rows.map((r) => r.column_name));

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (filters.action && cols.has("action")) {
    params.push(filters.action);
    whereClauses.push(`action = $${params.length}`);
  }
  if (filters.actorType && cols.has("actor_type")) {
    params.push(filters.actorType);
    whereClauses.push(`actor_type = $${params.length}`);
  }
  if (filters.actorId && cols.has("actor_id")) {
    params.push(filters.actorId);
    whereClauses.push(`actor_id = $${params.length}`);
  }
  if (filters.outcome && cols.has("outcome")) {
    params.push(filters.outcome);
    whereClauses.push(`outcome = $${params.length}`);
  }
  if (filters.visitorId) {
    params.push(filters.visitorId);
    whereClauses.push(`visitor_id = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    whereClauses.push(`created_at >= $${params.length}::timestamptz`);
  }
  if (filters.to) {
    params.push(filters.to);
    whereClauses.push(`created_at <= $${params.length}::timestamptz`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const prevHashSql = cols.has("prev_hash") ? `prev_hash as "prevHash"` : `NULL::text as "prevHash"`;
  const actionSql = cols.has("action") ? `COALESCE(action, 'UNKNOWN') as action` : `'UNKNOWN'::text as action`;
  const actorTypeSql = cols.has("actor_type") ? `COALESCE(actor_type, 'system') as "actorType"` : `'system'::text as "actorType"`;
  const actorIdSql = cols.has("actor_id") ? `actor_id as "actorId"` : `NULL::text as "actorId"`;
  const targetTypeSql = cols.has("target_type") ? `target_type as "targetType"` : `NULL::text as "targetType"`;
  const targetIdSql = cols.has("target_id") ? `target_id as "targetId"` : `NULL::text as "targetId"`;
  const outcomeSql = cols.has("outcome") ? `COALESCE(outcome, 'success') as outcome` : `'success'::text as outcome`;
  const requestIdSql = cols.has("request_id") ? `request_id as "requestId"` : `NULL::text as "requestId"`;
  const ipAddressSql = cols.has("ip_address") ? `ip_address as "ipAddress"` : `NULL::text as "ipAddress"`;
  const userAgentSql = cols.has("user_agent") ? `user_agent as "userAgent"` : `NULL::text as "userAgent"`;
  const changeSetSql = cols.has("change_set") ? `change_set as "changeSet"` : `NULL::jsonb as "changeSet"`;
  const metadataSql = cols.has("metadata") ? `COALESCE(metadata, '{}'::jsonb) as metadata` : `'{}'::jsonb as metadata`;

  const [count, list] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int as total FROM audit_ledger ${whereSql}`, params),
    pool.query(
      `SELECT id,
              visitor_id as "visitorId",
              hash,
              ${prevHashSql},
              ${actionSql},
              ${actorTypeSql},
              ${actorIdSql},
              ${targetTypeSql},
              ${targetIdSql},
              ${outcomeSql},
              ${requestIdSql},
              ${ipAddressSql},
              ${userAgentSql},
              ${changeSetSql},
              ${metadataSql},
              created_at as "createdAt"
       FROM audit_ledger
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, safeLimit, offset]
    ),
  ]);
  return { items: list.rows as LedgerEntry[], total: count.rows[0].total as number, page: Math.max(1, page), limit: safeLimit };
}

export async function verifyLedgerLinks(): Promise<{ ok: boolean; issues: Array<{ visitorId: number; index: number; message: string }> }> {
  // Verify that for each visitor, prev_hash chains to previous hash
  // Use a window function to detect mismatches directly in SQL to avoid loading
  // millions of rows into Node.js memory
  try {
    const res = await pool.query(
      `SELECT visitor_id, idx, prev_hash, expected_prev
       FROM (
         SELECT 
           visitor_id,
           ROW_NUMBER() OVER (PARTITION BY visitor_id ORDER BY created_at, id) - 1 AS idx,
           COALESCE(prev_hash, '') AS prev_hash,
           COALESCE(LAG(hash) OVER (PARTITION BY visitor_id ORDER BY created_at, id), '') AS expected_prev
         FROM audit_ledger
       ) sub
       WHERE prev_hash != expected_prev
       LIMIT 500`
    );
    const issues = res.rows.map((row: any) => ({
      visitorId: row.visitor_id as number,
      index: Number(row.idx),
      message: "prev_hash does not match previous hash",
    }));
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
    // Use a subquery since window functions (LAG) cannot appear in HAVING clauses
    const suspiciousRes = await pool.query(`
      SELECT visitor_id, entry_count, tampered_count
      FROM (
        SELECT 
          al.visitor_id,
          COUNT(*)::int as entry_count,
          SUM(CASE WHEN COALESCE(al.prev_hash,'') != COALESCE(
            LAG(al.hash) OVER (PARTITION BY al.visitor_id ORDER BY al.created_at)
          , '') THEN 1 ELSE 0 END)::int as tampered_count
        FROM audit_ledger al
        GROUP BY al.visitor_id
      ) sub
      WHERE tampered_count > 0
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

export async function getVisitorStats(): Promise<{
  total: number;
  registered: number;
  checkedIn: number;
  checkedOut: number;
  todayTotal: number;
  todayCheckedIn: number;
}> {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'registered')::int AS registered,
      COUNT(*) FILTER (WHERE status = 'checked_in')::int AS "checkedIn",
      COUNT(*) FILTER (WHERE status = 'checked_out')::int AS "checkedOut",
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS "todayTotal",
      COUNT(*) FILTER (WHERE status = 'checked_in' AND checked_in_at >= CURRENT_DATE)::int AS "todayCheckedIn"
    FROM visitors
  `);
  return result.rows[0];
}

export async function exportVisitorsCsv(status?: string): Promise<string> {
  const params: any[] = [];
  let whereSql = "";
  if (status && status !== "all") {
    params.push(status);
    whereSql = `WHERE status = $1`;
  }

  const result = await pool.query(
    `SELECT id, name, email, phone, purpose, status,
            checked_in_at, checked_out_at, created_at
     FROM visitors ${whereSql}
     ORDER BY created_at DESC`,
    params
  );

  const header = "ID,Name,Email,Phone,Purpose,Status,Checked In,Checked Out,Registered At";
  const rows = result.rows.map((r: any) => {
    // Escape for CSV: wrap in quotes & double-escape internal quotes
    // Also prefix formulas with single-quote to prevent CSV injection in spreadsheet apps
    const escape = (val: string) => {
      const safe = (val ?? "").replace(/"/g, '""');
      // Prevent CSV injection: prefix formula-start chars with a single quote
      const sanitized = /^[=+\-@\t\r]/.test(safe) ? `'${safe}` : safe;
      return `"${sanitized}"`;
    };
    return [
      r.id,
      escape(r.name),
      escape(r.email),
      escape(r.phone),
      escape(r.purpose),
      r.status,
      r.checked_in_at ? new Date(r.checked_in_at).toISOString() : "",
      r.checked_out_at ? new Date(r.checked_out_at).toISOString() : "",
      new Date(r.created_at).toISOString(),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Core ledger recording logic that accepts a queryable (pool or transaction client).
 */
async function recordLedgerEntryImpl(
  queryable: { query: (sql: string, params: any[]) => Promise<any> },
  visitor: Visitor,
  options: RecordLedgerOptions
): Promise<void> {
  const nowIso = new Date().toISOString();
  const payloadMetadata: Record<string, unknown> = {
    eventAt: nowIso,
    action: options.action,
    targetType: options.targetType ?? "visitor",
    targetId: options.targetId ?? String(visitor.id),
    outcome: options.outcome ?? "success",
    ...options.metadata,
  };

  const payload = JSON.stringify({
    id: visitor.id,
    status: visitor.status,
    qrToken: visitor.qrToken,
    action: options.action,
    changeSet: options.changeSet ?? null,
    metadata: payloadMetadata,
    actorType: options.context?.actorType ?? "system",
    actorId: options.context?.actorId ?? null,
    requestId: options.context?.requestId ?? null,
    timestamp: nowIso,
  });

  // Fetch previous hash (last inserted) to build chain for tamper resistance
  let prevHash: string | null = null;
  try {
    const prevResult = await queryable.query(
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
    await queryable.query(
      `INSERT INTO audit_ledger (
        visitor_id,
        hash,
        prev_hash,
        action,
        actor_type,
        actor_id,
        target_type,
        target_id,
        outcome,
        request_id,
        ip_address,
        user_agent,
        change_set,
        metadata
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)`,
      [
        visitor.id,
        hash,
        prevHash,
        options.action,
        options.context?.actorType ?? "system",
        options.context?.actorId ?? null,
        options.targetType ?? "visitor",
        options.targetId ?? String(visitor.id),
        options.outcome ?? "success",
        options.context?.requestId ?? null,
        options.context?.ipAddress ?? null,
        options.context?.userAgent ?? null,
        JSON.stringify(options.changeSet ?? null),
        JSON.stringify(payloadMetadata),
      ]
    );
  } catch {
    try {
      await queryable.query(
        `INSERT INTO audit_ledger (visitor_id, hash, prev_hash)
         VALUES ($1, $2, $3)`,
        [visitor.id, hash, prevHash]
      );
    } catch {
      await queryable.query(
        `INSERT INTO audit_ledger (visitor_id, hash)
         VALUES ($1, $2)`,
        [visitor.id, hash]
      );
    }
  }
}

/** Record a ledger entry using the shared pool */
async function recordLedgerEntry(visitor: Visitor, options: RecordLedgerOptions): Promise<void> {
  return recordLedgerEntryImpl(pool, visitor, options);
}

/** Record a ledger entry using a specific transaction client */
async function recordLedgerEntryWithClient(
  client: { query: (sql: string, params: any[]) => Promise<any> },
  visitor: Visitor,
  options: RecordLedgerOptions
): Promise<void> {
  return recordLedgerEntryImpl(client, visitor, options);
}
