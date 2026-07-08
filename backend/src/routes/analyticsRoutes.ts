import { Router, Request, Response, NextFunction } from "express";
import { listRecentEvents, recordEvent } from "../services/analyticsService.js";
import { z } from "zod";
import axios from "axios";
import rateLimit from "express-rate-limit";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { servicesConfig, upstreamConfig } from "../config.js";
import { safeCompare } from "../utils/crypto.js";
import { pool } from "../db/pool.js";
import { CircuitBreaker } from "../utils/circuitBreaker.js";

const router = Router();
const ANALYTICS_URL = servicesConfig.analyticsUrl;
const ANALYTICS_TIMEOUT_MS = 30_000;
const DASHBOARD_CACHE_TTL_MS = 30_000;
const dashboardCache = new Map<string, { expiresAt: number; data: any; cachedAt: string }>();

const expensiveAnalyticsLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  message: { message: "Too many analytics requests, please retry shortly" },
  standardHeaders: true,
  legacyHeaders: false,
});

const analyticsHttp = axios.create({
  baseURL: ANALYTICS_URL,
  timeout: ANALYTICS_TIMEOUT_MS,
  headers: servicesConfig.serviceApiKey
    ? { "x-service-key": servicesConfig.serviceApiKey }
    : undefined,
});

const analyticsBreaker = new CircuitBreaker({
  name: "analytics",
  failureThreshold: upstreamConfig.circuitBreaker.failureThreshold,
  resetTimeoutMs: upstreamConfig.circuitBreaker.resetTimeoutMs,
  halfOpenSuccesses: upstreamConfig.circuitBreaker.halfOpenSuccesses,
  unavailableMessage: "Analytics service temporarily unavailable",
  unavailableCode: "ANALYTICS_CIRCUIT_OPEN",
  shouldCountFailure: (error: any) => {
    const status = error?.response?.status;
    if (typeof status === "number") {
      return status === 429 || status >= 500;
    }
    const code = error?.code as string | undefined;
    return ["ECONNABORTED", "ECONNRESET", "ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT"].includes(
      code || ""
    );
  },
});

function shouldRetryAnalyticsError(error: any): boolean {
  const status = error?.response?.status;
  if (status && [408, 429, 500, 502, 503, 504].includes(status)) return true;
  const code = error?.code as string | undefined;
  return code === "ECONNABORTED" || code === "ECONNRESET" || code === "ENOTFOUND";
}

async function requestAnalytics<T = any>(
  path: string,
  params?: Record<string, unknown>,
  requestId?: string,
  maxAttempts = 2
) {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < maxAttempts) {
    try {
      return await analyticsBreaker.execute(() =>
        analyticsHttp.get<T>(path, {
          params,
          headers: requestId ? { "x-request-id": requestId } : undefined,
        })
      );
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= maxAttempts || !shouldRetryAnalyticsError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError;
}

/**
 * Internal service auth middleware.
 * Accepts either admin auth (requireAdmin) OR the service-to-service key.
 * This allows the biometric service to POST events without admin credentials.
 */
function requireAdminOrServiceKey(req: Request, res: Response, next: NextFunction): void {
  // Check service key first (for service-to-service calls)
  const serviceKey = req.headers["x-service-key"] as string | undefined;
  if (serviceKey && servicesConfig.serviceApiKey && safeCompare(serviceKey, servicesConfig.serviceApiKey)) {
    return next();
  }
  // Fall through to standard admin auth
  requireAdmin(req, res, next);
}

/**
 * POST /api/analytics/events
 * Body: { name: string; payload?: any }
 * Response: { ok: true }
 * Accepts admin auth OR service-to-service key.
 */
router.post("/events", requireAdminOrServiceKey, asyncHandler(async (req: Request, res: Response) => {
  const { name, payload } = req.body as { name?: string; payload?: any };
  if (!name || !name.trim()) {
    res.status(400).json({ ok: false, error: "Event name required" });
    return;
  }
  await recordEvent(name.trim(), payload);
  res.json({ ok: true });
}));

// GET /api/analytics/events?limit=100
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).optional() });
router.get("/events", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { limit } = listQuery.parse(req.query);
  const items = await listRecentEvents(limit ?? 100);
  res.json({ items });
}));

/**
 * GET /api/analytics/report?days=30
 * Comprehensive analytics from Python service
 */
const reportQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

router.get("/report", requireAdmin, expensiveAnalyticsLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { days } = reportQuery.parse(req.query);
  const response = await requestAnalytics("/analytics", { days: days ?? 30 }, (req.id as string));
  res.json(response.data);
}));

/**
 * GET /api/analytics/peak-hours?days=30
 * Peak hour predictions
 */
router.get("/peak-hours", requireAdmin, expensiveAnalyticsLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { days } = reportQuery.parse(req.query);
  const response = await requestAnalytics("/analytics/peak-hours", { days: days ?? 30 }, (req.id as string));
  res.json(response.data);
}));

/**
 * GET /api/analytics/frequent-visitors?limit=10&min_visits=2
 * Top frequent visitors
 */
const frequentQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  min_visits: z.coerce.number().int().min(1).optional(),
});

router.get("/frequent-visitors", requireAdmin, expensiveAnalyticsLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { limit, min_visits } = frequentQuery.parse(req.query);
  const response = await requestAnalytics("/analytics/frequent-visitors", {
    limit: limit ?? 10,
    min_visits: min_visits ?? 2,
  }, (req.id as string));
  res.json(response.data);
}));

/**
 * GET /api/analytics/suspicious-activity?threshold=0.05
 * Detect suspicious visitor patterns
 */
const suspiciousQuery = z.object({
  threshold: z.coerce.number().min(0.01).max(0.5).optional(),
});

router.get("/suspicious-activity", requireAdmin, expensiveAnalyticsLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { threshold } = suspiciousQuery.parse(req.query);
  const response = await requestAnalytics("/analytics/suspicious-activity", {
    threshold: threshold ?? 0.05,
  }, (req.id as string));
  res.json(response.data);
}));

/**
 * GET /api/analytics/trends?days=30
 * Visitor count trends
 */
router.get("/trends", requireAdmin, expensiveAnalyticsLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { days } = reportQuery.parse(req.query);
  const response = await requestAnalytics("/analytics/trends", { days: days ?? 30 }, (req.id as string));
  res.json(response.data);
}));

/**
 * GET /api/analytics/dashboard?days=30
 * Aggregated dashboard payload in one request.
 */
router.get("/dashboard", requireAdmin, expensiveAnalyticsLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { days } = reportQuery.parse(req.query);
  const safeDays = days ?? 30;
  const cacheKey = `days:${safeDays}`;
  const cached = dashboardCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    res.json({ ...cached.data, cache: { hit: true, cachedAt: cached.cachedAt } });
    return;
  }

  try {
    const [report, peakHours, frequentVisitors, suspiciousActivity, trends] = await Promise.allSettled([
      requestAnalytics("/analytics", { days: safeDays }, (req.id as string)),
      requestAnalytics("/analytics/peak-hours", { days: safeDays }, (req.id as string)),
      requestAnalytics("/analytics/frequent-visitors", { limit: 10, min_visits: 2 }, (req.id as string)),
      requestAnalytics("/analytics/suspicious-activity", { threshold: 0.05 }, (req.id as string)),
      requestAnalytics("/analytics/trends", { days: safeDays }, (req.id as string)),
    ]);

    const partialErrors: string[] = [];
    const data = {
      report: { summary: {} as Record<string, unknown> },
      peakHours: { forecast: {}, peak_hours: [], error: null as string | null },
      frequentVisitors: [] as any[],
      suspiciousActivity: { suspicious_visitors: [] as any[] },
      trends: [] as any[],
      statusDistribution: [] as any[],
      partialErrors,
      generatedAt: new Date().toISOString(),
    };

    if (report.status === "fulfilled") data.report = report.value.data;
    else partialErrors.push("Report");

    if (peakHours.status === "fulfilled") data.peakHours = peakHours.value.data;
    else partialErrors.push("Peak hours");

    if (frequentVisitors.status === "fulfilled") data.frequentVisitors = frequentVisitors.value.data?.visitors || [];
    else partialErrors.push("Frequent visitors");

    if (suspiciousActivity.status === "fulfilled") data.suspiciousActivity = suspiciousActivity.value.data;
    else partialErrors.push("Suspicious activity");

    if (trends.status === "fulfilled") data.trends = Array.isArray(trends.value.data?.trends) ? trends.value.data.trends : [];
    else partialErrors.push("Trends");

    // Reuse existing resilient status distribution endpoint behavior by local logic.
    try {
      const local = await pool.query(
        `SELECT status, COUNT(*)::int as count
         FROM visitors
         GROUP BY status`
      );
      data.statusDistribution = local.rows.map((r: any) => ({ status: String(r.status), count: Number(r.count) }));
    } catch {
      partialErrors.push("Status distribution");
    }

    dashboardCache.set(cacheKey, {
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
      data,
      cachedAt: new Date().toISOString(),
    });

    res.json({ ...data, cache: { hit: false } });
  } catch (error) {
    if (cached) {
      res.json({
        ...cached.data,
        cache: { hit: true, stale: true, cachedAt: cached.cachedAt },
        partialErrors: [...(cached.data?.partialErrors || []), "Using stale cached snapshot"],
      });
      return;
    }
    throw error;
  }
}));

/**
 * GET /api/analytics/status-distribution
 * Visitor count by status (registered, checked_in, checked_out)
 */
router.get("/status-distribution", requireAdmin, expensiveAnalyticsLimiter, asyncHandler(async (_req: Request, res: Response) => {
  const getLocalDistribution = async () => {
    const local = await pool.query(
      `SELECT status, COUNT(*)::int as count
       FROM visitors
       GROUP BY status`
    );
    return local.rows.map((r: any) => ({ status: String(r.status), count: Number(r.count) }));
  };

  const endpoints = [
    `${ANALYTICS_URL}/analytics/status-distribution`,
    `${ANALYTICS_URL}/analytics/status_distribution`,
    `${ANALYTICS_URL}/status-distribution`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint, {
        timeout: ANALYTICS_TIMEOUT_MS,
        headers: {
          ...(servicesConfig.serviceApiKey ? { "x-service-key": servicesConfig.serviceApiKey } : {}),
          ...((_req.id as string) ? { "x-request-id": (_req.id as string) } : {}),
        },
      });

      const rawData = response.data;
      if (Array.isArray(rawData?.distribution)) {
        res.json({ distribution: rawData.distribution });
        return;
      }

      if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
        const distribution = Object.entries(rawData)
          .filter(([, count]) => Number.isFinite(Number(count)))
          .map(([status, count]) => ({ status, count: Number(count) }));
        res.json({ distribution });
        return;
      }

      res.json({ distribution: [] });
      return;
    } catch (error: any) {
      // Retry with the next known endpoint variant only for 404s.
      if (error?.response?.status === 404) {
        continue;
      }
      throw error;
    }
  }

  // Graceful fallback: if all upstream variants fail (commonly 404/503),
  // serve distribution directly from backend DB so dashboard remains usable.
  const distribution = await getLocalDistribution();
  res.json({ distribution });
}));

export default router;
