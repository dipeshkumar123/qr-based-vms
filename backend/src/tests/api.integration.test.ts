/**
 * api.integration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive integration tests for the II-VMS backend.
 *
 * Strategy
 * ────────
 * • vi.mock calls are hoisted by vitest to the very top - this is the key
 *   mechanism we use to inject config BEFORE any module reads process.env.
 * • The pg Pool (src/db/pool.ts) is fully mocked so no live PostgreSQL is needed.
 * • visitorService functions are mocked to control returned data precisely.
 * • adminSettingsService is mocked to avoid FS writes in tests.
 * • notificationService is mocked so no SMTP/Twilio calls happen.
 * • Auth: admin-protected routes accept the x-admin-key header (legacy fallback
 *   in requireAdmin middleware). The config mock injects the key directly.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";

// ─── Constants (used both in mocks below AND in test assertions) ───────────────
// NOTE: these must be plain literals here because vi.mock factories run before
//       module-level const declarations in the outer scope.
const TEST_ADMIN_KEY = "test-admin-key-super-secret-1234"; // 32 chars >= 16 minimum
const TEST_JWT_SECRET = "test-jwt-secret-super-secret-abc-xyz-000"; // >= 24 chars

// ─── Mock: src/config.js ──────────────────────────────────────────────────────
// Hoisted by vitest – fires before ANY other module in this file is imported.
vi.mock("../config.js", () => ({
  serverConfig: {
    port: 4000,
    nodeEnv: "test",
    isProd: false,
    corsOrigin: ["http://localhost:5173"],
    publicBaseUrl: "",
    uploadDir: "uploads",
    logLevel: "silent",
  },
  dbConfig: {
    connectionString: "postgresql://fake:fake@localhost:5432/fake",
    requiredSchemaVersion: "2026.04.05.1",
    poolMax: 5,
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 5000,
    statementTimeoutMs: 30000,
    slowQueryMs: 300,
    retryAttempts: 1,
    retryDelayMs: 100,
  },
  authConfig: {
    adminApiKey: "test-admin-key-super-secret-1234",
    jwtSecret: "test-jwt-secret-super-secret-abc-xyz-000",
    jwtExpiresIn: "2h",
    jwtAlgorithm: "HS256",
    jwtIssuer: "ii-vms",
    jwtAudience: "ii-vms-admin",
  },
  servicesConfig: {
    biometricUrl: "http://localhost:8000",
    analyticsUrl: "http://localhost:8001",
    serviceApiKey: "",
  },
  upstreamConfig: {
    circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 30000, halfOpenSuccesses: 2 },
  },
  biometricFallbackConfig: {
    enabled: true,
    mode: "manual_review_required",
    retryAfterSeconds: 30,
  },
  getSecretHygieneWarnings: () => [],
}));

// ─── Mock: pg pool ────────────────────────────────────────────────────────────
vi.mock("../db/pool.js", () => {
  const mockPool = {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  return {
    pool: mockPool,
    ensureDatabaseConnection: vi.fn().mockResolvedValue(undefined),
    validateDatabaseSchema: vi.fn().mockResolvedValue({ ok: true, missing: [] }),
  };
});

// ─── Mock: visitorService ──────────────────────────────────────────────────────
vi.mock("../services/visitorService.js", () => ({
  createVisitor: vi.fn(),
  listVisitors: vi.fn(),
  findVisitorByQrToken: vi.fn(),
  checkInVisitor: vi.fn(),
  checkOutVisitor: vi.fn(),
  getLedger: vi.fn(),
  verifyLedgerLinks: vi.fn(),
  generateAuditReport: vi.fn(),
  getVisitorStats: vi.fn(),
  exportVisitorsCsv: vi.fn(),
  findVisitorById: vi.fn(),
  updateVisitor: vi.fn(),
  deleteVisitor: vi.fn(),
}));

// ─── Mock: notificationService ─────────────────────────────────────────────────
vi.mock("../services/notificationService.js", () => ({
  notifyVisitorArrival: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock: adminSettingsService ────────────────────────────────────────────────
vi.mock("../services/adminSettingsService.js", () => ({
  getAlertThresholds: vi.fn().mockResolvedValue({
    registrationBacklogRatio: 0.8,
    lowTodayCheckInRate: 0.3,
    activePopulationGap: 20,
  }),
  saveAlertThresholds: vi.fn().mockImplementation(async (t: unknown) => t),
  DEFAULT_ALERT_THRESHOLDS: {
    registrationBacklogRatio: 0.8,
    lowTodayCheckInRate: 0.3,
    activePopulationGap: 20,
  },
}));

// ─── Mock: idempotency middleware (pass-through in tests) ─────────────────────
vi.mock("../middleware/idempotency.js", () => ({
  idempotency: () => (_req: any, _res: any, next: any) => next(),
}));

// ─── Lazy imports AFTER mocks are registered ──────────────────────────────────
import {
  createVisitor,
  listVisitors,
  findVisitorByQrToken,
  checkInVisitor,
  checkOutVisitor,
  getLedger,
  generateAuditReport,
  getVisitorStats,
} from "../services/visitorService.js";
import { buildTestApp } from "./helpers/testApp.js";
import { HttpError } from "../utils/httpError.js";

// ─── Auth header shortcut ──────────────────────────────────────────────────────
const authHeader = { "x-admin-key": TEST_ADMIN_KEY };

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const visitorFixture = {
  id: 1,
  name: "Alice Smith",
  email: "alice@example.com",
  phone: "1234567890",
  purpose: "Interview",
  status: "registered" as const,
  qrToken: "qr-token-abc-123",
  checkedInAt: null,
  checkedOutAt: null,
  createdAt: "2026-06-27T10:00:00.000Z",
  updatedAt: "2026-06-27T10:00:00.000Z",
};

const checkedInVisitorFixture = {
  ...visitorFixture,
  status: "checked_in" as const,
  checkedInAt: "2026-06-27T11:00:00.000Z",
};

const checkedOutVisitorFixture = {
  ...visitorFixture,
  status: "checked_out" as const,
  checkedInAt: "2026-06-27T11:00:00.000Z",
  checkedOutAt: "2026-06-27T12:00:00.000Z",
};

// ─── App bootstrap ─────────────────────────────────────────────────────────────
let app: Express;

beforeAll(() => {
  app = buildTestApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// POST /api/visitors  – create visitor
// =============================================================================
describe("POST /api/visitors", () => {
  const validBody = {
    name: "Alice Smith",
    email: "alice@example.com",
    phone: "1234567890",
    purpose: "Interview session",
  };

  it("201 – creates a visitor with valid input", async () => {
    (createVisitor as any).mockResolvedValue(visitorFixture);

    const res = await request(app).post("/api/visitors").send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, name: "Alice Smith", email: "alice@example.com" });
    expect(createVisitor).toHaveBeenCalledOnce();
  });

  it("400 – missing required field (name)", async () => {
    const { name: _name, ...bodyWithoutName } = validBody;
    const res = await request(app).post("/api/visitors").send(bodyWithoutName);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("400 – invalid email format", async () => {
    const res = await request(app)
      .post("/api/visitors")
      .send({ ...validBody, email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("400 – name too short (< 2 chars)", async () => {
    const res = await request(app)
      .post("/api/visitors")
      .send({ ...validBody, name: "A" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("400 – phone pattern invalid", async () => {
    const res = await request(app)
      .post("/api/visitors")
      .send({ ...validBody, phone: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("400 – purpose too short (< 3 chars)", async () => {
    const res = await request(app)
      .post("/api/visitors")
      .send({ ...validBody, purpose: "Hi" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("400 – extra unknown field (strict schema)", async () => {
    const res = await request(app)
      .post("/api/visitors")
      .send({ ...validBody, unknownField: "oops" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("500 – service throws unexpected error", async () => {
    (createVisitor as any).mockRejectedValue(new Error("DB connection lost"));

    const res = await request(app).post("/api/visitors").send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

// =============================================================================
// GET /api/visitors  – list visitors (admin-protected)
// =============================================================================
describe("GET /api/visitors", () => {
  const listResult = {
    items: [visitorFixture],
    total: 1,
    page: 1,
    limit: 20,
  };

  it("200 – returns paginated list with valid admin key", async () => {
    (listVisitors as any).mockResolvedValue(listResult);

    const res = await request(app).get("/api/visitors").set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(res.body.items).toHaveLength(1);
  });

  it("401 – no admin key returns unauthorized", async () => {
    const res = await request(app).get("/api/visitors");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("200 – supports page & limit query params", async () => {
    (listVisitors as any).mockResolvedValue({ ...listResult, page: 2, limit: 5 });

    const res = await request(app)
      .get("/api/visitors?page=2&limit=5")
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(listVisitors).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 5 }));
  });

  it("200 – supports status filter", async () => {
    (listVisitors as any).mockResolvedValue({ ...listResult, items: [] });

    const res = await request(app)
      .get("/api/visitors?status=checked_in")
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(listVisitors).toHaveBeenCalledWith(expect.objectContaining({ status: "checked_in" }));
  });

  it("400 – invalid status enum value", async () => {
    const res = await request(app)
      .get("/api/visitors?status=invalid_status")
      .set(authHeader);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("400 – limit > 100 is rejected", async () => {
    const res = await request(app)
      .get("/api/visitors?limit=999")
      .set(authHeader);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });
});

// =============================================================================
// GET /api/visitors/:token  – QR token lookup
// =============================================================================
describe("GET /api/visitors/:token (QR lookup)", () => {
  it("200 – returns visitor for valid QR token", async () => {
    (findVisitorByQrToken as any).mockResolvedValue(visitorFixture);

    const res = await request(app)
      .get("/api/visitors/qr-token-abc-123")
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, qrToken: "qr-token-abc-123" });
  });

  it("404 – returns 404 for non-existent QR token", async () => {
    (findVisitorByQrToken as any).mockResolvedValue(null);

    const res = await request(app)
      .get("/api/visitors/nonexistent-token")
      .set(authHeader);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("401 – no admin key returns unauthorized", async () => {
    const res = await request(app).get("/api/visitors/some-token");
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// POST /api/visitors/:token/check-in  – check-in flow
// =============================================================================
describe("POST /api/visitors/:token/check-in", () => {
  it("200 – successful check-in", async () => {
    (checkInVisitor as any).mockResolvedValue(checkedInVisitorFixture);

    const res = await request(app)
      .post("/api/visitors/qr-token-abc-123/check-in")
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "checked_in" });
    expect(checkInVisitor).toHaveBeenCalledWith("qr-token-abc-123", expect.any(Object));
  });

  it("404 – visitor not found (service returns null)", async () => {
    (checkInVisitor as any).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/visitors/no-such-token/check-in")
      .set(authHeader);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("409 – already checked in (service throws HttpError 409)", async () => {
    (checkInVisitor as any).mockRejectedValue(
      new HttpError(409, "Visitor is already checked in.")
    );

    const res = await request(app)
      .post("/api/visitors/qr-token-abc-123/check-in")
      .set(authHeader);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already checked in/i);
  });

  it("409 – visit already completed (service throws HttpError 409)", async () => {
    (checkInVisitor as any).mockRejectedValue(
      new HttpError(409, "This visit is already completed. Please register a new visit.")
    );

    const res = await request(app)
      .post("/api/visitors/qr-token-abc-123/check-in")
      .set(authHeader);

    expect(res.status).toBe(409);
  });

  it("401 – no admin key", async () => {
    const res = await request(app).post("/api/visitors/qr-token-abc-123/check-in");
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// POST /api/visitors/:token/check-out  – check-out flow
// =============================================================================
describe("POST /api/visitors/:token/check-out", () => {
  it("200 – successful check-out", async () => {
    (checkOutVisitor as any).mockResolvedValue(checkedOutVisitorFixture);

    const res = await request(app)
      .post("/api/visitors/qr-token-abc-123/check-out")
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "checked_out" });
    expect(checkOutVisitor).toHaveBeenCalledWith("qr-token-abc-123", expect.any(Object));
  });

  it("404 – visitor not found", async () => {
    (checkOutVisitor as any).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/visitors/no-such-token/check-out")
      .set(authHeader);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("409 – visitor not checked in yet", async () => {
    (checkOutVisitor as any).mockRejectedValue(
      new HttpError(409, "Visitor has not checked in yet.")
    );

    const res = await request(app)
      .post("/api/visitors/qr-token-abc-123/check-out")
      .set(authHeader);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/not checked in/i);
  });

  it("409 – already checked out", async () => {
    (checkOutVisitor as any).mockRejectedValue(
      new HttpError(409, "Visitor is already checked out.")
    );

    const res = await request(app)
      .post("/api/visitors/qr-token-abc-123/check-out")
      .set(authHeader);

    expect(res.status).toBe(409);
  });

  it("401 – no admin key", async () => {
    const res = await request(app).post("/api/visitors/qr-token-abc-123/check-out");
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// GET /api/ledger  – audit ledger retrieval
// =============================================================================
describe("GET /api/ledger (audit ledger)", () => {
  const ledgerResult = {
    items: [
      {
        id: 1,
        hash: "abc123",
        prevHash: null,
        visitorId: 1,
        action: "VISITOR_CREATED",
        actorType: "system",
        actorId: null,
        targetType: "visitor",
        targetId: "1",
        outcome: "success",
        requestId: null,
        ipAddress: null,
        userAgent: null,
        changeSet: null,
        metadata: {},
        createdAt: "2026-06-27T10:00:00.000Z",
      },
    ],
    total: 1,
    page: 1,
    limit: 100,
  };

  it("200 – returns ledger entries with admin key", async () => {
    (getLedger as any).mockResolvedValue(ledgerResult);

    const res = await request(app).get("/api/ledger").set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, page: 1 });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ action: "VISITOR_CREATED", outcome: "success" });
  });

  it("401 – no admin key", async () => {
    const res = await request(app).get("/api/ledger");
    expect(res.status).toBe(401);
  });

  it("200 – pagination params are forwarded to service", async () => {
    (getLedger as any).mockResolvedValue({ ...ledgerResult, page: 3, limit: 50 });

    const res = await request(app)
      .get("/api/ledger?page=3&limit=50")
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(getLedger).toHaveBeenCalledWith(3, 50, expect.any(Object));
  });

  it("400 – invalid datetime for 'from' filter", async () => {
    const res = await request(app)
      .get("/api/ledger?from=not-a-date")
      .set(authHeader);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });
});

// =============================================================================
// GET /api/ledger/report  – audit report
// =============================================================================
describe("GET /api/ledger/report", () => {
  const reportFixture = {
    ok: true,
    totalEntries: 5,
    chainIntegrity: { ok: true, issues: [] },
    visitorsSuspicious: [],
    lastVerified: "2026-06-27T12:00:00.000Z",
  };

  it("200 – returns audit report", async () => {
    (generateAuditReport as any).mockResolvedValue(reportFixture);

    const res = await request(app).get("/api/ledger/report").set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, totalEntries: 5 });
  });

  it("401 – no admin key", async () => {
    const res = await request(app).get("/api/ledger/report");
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// POST /api/admin/login  – admin authentication
// =============================================================================
describe("POST /api/admin/login", () => {
  it("200 – valid admin key returns ok:true and sets cookie", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ key: TEST_ADMIN_KEY });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    // Should set the admin_token cookie
    const rawCookies = res.headers["set-cookie"] ?? [];
    const cookies: string[] = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    const adminCookie = cookies.find((c: string) => c.startsWith("admin_token="));
    expect(adminCookie).toBeDefined();
  });

  it("401 – wrong admin key", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ key: "wrong-key-that-is-long-enough-xxx" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_INVALID_ADMIN_KEY");
  });

  it("400 – key too short (< 8 chars per schema)", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ key: "short" });

    expect(res.status).toBe(400);
  });

  it("400 – missing key field", async () => {
    const res = await request(app).post("/api/admin/login").send({});
    expect(res.status).toBe(400);
  });

  it("400 – extra unknown field (strict schema)", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ key: TEST_ADMIN_KEY, extra: "oops" });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// POST /api/admin/logout  – admin logout
// =============================================================================
describe("POST /api/admin/logout", () => {
  it("204 – clears admin cookie", async () => {
    const res = await request(app).post("/api/admin/logout");
    expect(res.status).toBe(204);
  });
});

// =============================================================================
// GET /api/admin/verify  – JWT/key verification
// =============================================================================
describe("GET /api/admin/verify", () => {
  it("204 – valid x-admin-key header", async () => {
    const res = await request(app).get("/api/admin/verify").set(authHeader);
    expect(res.status).toBe(204);
  });

  it("401 – no auth", async () => {
    const res = await request(app).get("/api/admin/verify");
    expect(res.status).toBe(401);
  });

  it("204 – login then verify with JWT cookie", async () => {
    // Step 1: Login to get JWT cookie
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ key: TEST_ADMIN_KEY });

    expect(loginRes.status).toBe(200);

    const rawCookies = loginRes.headers["set-cookie"] ?? [];
    const cookieStrings: string[] = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    // Extract just the cookie name=value pairs (before the semicolon)
    const cookieHeader = cookieStrings.map((c: string) => c.split(";")[0]).join("; ");

    // Step 2: Use the cookie for verify
    const verifyRes = await request(app)
      .get("/api/admin/verify")
      .set("Cookie", cookieHeader);

    expect(verifyRes.status).toBe(204);
  });
});

// =============================================================================
// GET /health  – health check (sanity)
// =============================================================================
describe("GET /health", () => {
  it("200 – returns status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// =============================================================================
// 404 – unknown routes
// =============================================================================
describe("404 handler", () => {
  it("returns 404 for unknown API path", async () => {
    const res = await request(app).get("/api/unknown-endpoint-xyz");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ROUTE_NOT_FOUND");
  });
});

// =============================================================================
// Error handling edge cases
// =============================================================================
describe("Error handling edge cases", () => {
  it("400 – malformed JSON body returns VALIDATION_MALFORMED_JSON", async () => {
    const res = await request(app)
      .post("/api/visitors")
      .set("Content-Type", "application/json")
      .send("{invalid json{{");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_MALFORMED_JSON");
  });

  it("GET /api/visitors/stats – returns 200 with visitor stats", async () => {
    (getVisitorStats as any).mockResolvedValue({
      total: 10,
      registered: 5,
      checkedIn: 3,
      checkedOut: 2,
      todayTotal: 4,
      todayCheckedIn: 2,
    });

    const res = await request(app).get("/api/visitors/stats").set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 10 });
  });

  it("GET /api/visitors/stats – 401 without admin key", async () => {
    const res = await request(app).get("/api/visitors/stats");
    expect(res.status).toBe(401);
  });
});
