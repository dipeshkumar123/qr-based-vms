import { Router, Request, Response, NextFunction } from "express";
import { listRecentEvents, recordEvent } from "../services/analyticsService.js";
import { z } from "zod";
import axios from "axios";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { servicesConfig } from "../config.js";
import { safeCompare } from "../utils/crypto.js";

const router = Router();
const ANALYTICS_URL = servicesConfig.analyticsUrl;
const ANALYTICS_TIMEOUT_MS = 30_000;

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

router.get("/report", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { days } = reportQuery.parse(req.query);
  const response = await axios.get(`${ANALYTICS_URL}/analytics`, {
    params: { days: days ?? 30 },
    timeout: ANALYTICS_TIMEOUT_MS,
  });
  res.json(response.data);
}));

/**
 * GET /api/analytics/peak-hours?days=30
 * Peak hour predictions
 */
router.get("/peak-hours", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { days } = reportQuery.parse(req.query);
  const response = await axios.get(`${ANALYTICS_URL}/analytics/peak-hours`, {
    params: { days: days ?? 30 },
    timeout: ANALYTICS_TIMEOUT_MS,
  });
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

router.get("/frequent-visitors", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { limit, min_visits } = frequentQuery.parse(req.query);
  const response = await axios.get(`${ANALYTICS_URL}/analytics/frequent-visitors`, {
    params: { limit: limit ?? 10, min_visits: min_visits ?? 2 },
    timeout: ANALYTICS_TIMEOUT_MS,
  });
  res.json(response.data);
}));

/**
 * GET /api/analytics/suspicious-activity?threshold=0.05
 * Detect suspicious visitor patterns
 */
const suspiciousQuery = z.object({
  threshold: z.coerce.number().min(0.01).max(0.5).optional(),
});

router.get("/suspicious-activity", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { threshold } = suspiciousQuery.parse(req.query);
  const response = await axios.get(`${ANALYTICS_URL}/analytics/suspicious-activity`, {
    params: { threshold: threshold ?? 0.05 },
    timeout: ANALYTICS_TIMEOUT_MS,
  });
  res.json(response.data);
}));

/**
 * GET /api/analytics/trends?days=30
 * Visitor count trends
 */
router.get("/trends", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { days } = reportQuery.parse(req.query);
  const response = await axios.get(`${ANALYTICS_URL}/analytics/trends`, {
    params: { days: days ?? 30 },
    timeout: ANALYTICS_TIMEOUT_MS,
  });
  res.json(response.data);
}));

/**
 * GET /api/analytics/status-distribution
 * Visitor count by status (registered, checked_in, checked_out)
 */
router.get("/status-distribution", requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const response = await axios.get(`${ANALYTICS_URL}/analytics/status-distribution`, {
    timeout: ANALYTICS_TIMEOUT_MS,
  });
  res.json(response.data);
}));

export default router;
