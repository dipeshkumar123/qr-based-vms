import { Router, Request, Response } from "express";
import { listRecentEvents, recordEvent } from "../services/analyticsService.js";
import { z } from "zod";
import axios from "axios";
import { notifySuspiciousActivity, notifyRepeatedVisits } from "../services/notificationService.js";

const router = Router();

/**
 * POST /api/analytics/events
 * Body: { name: string; payload?: any }
 * Response: { ok: true }
 */
router.post("/events", async (req: Request, res: Response) => {
  const { name, payload } = req.body as { name?: string; payload?: any };
  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: "Event name required" });
  }
  try {
    await recordEvent(name.trim(), payload);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || "Failed to record event" });
  }
});

// GET /api/analytics/events?limit=100
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).optional() });
router.get("/events", async (req: Request, res: Response) => {
  try {
    const { limit } = listQuery.parse(req.query);
    const items = await listRecentEvents(limit ?? 100);
    res.json({ items });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message || "Invalid request" });
  }
});

/**
 * GET /api/analytics/report?days=30
 * Comprehensive analytics from Python service
 */
const reportQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

router.get("/report", async (req: Request, res: Response) => {
  try {
    const { days } = reportQuery.parse(req.query);
    const analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8001";
    const response = await axios.get(`${analyticsServiceUrl}/analytics`, {
      params: { days: days ?? 30 },
      timeout: 30000,
    });
    res.json(response.data);
  } catch (e: any) {
    console.error("Analytics report error:", e.message);
    res.status(500).json({
      ok: false,
      error: e.message || "Failed to fetch analytics report",
    });
  }
});

/**
 * GET /api/analytics/peak-hours?days=30
 * Peak hour predictions
 */
router.get("/peak-hours", async (req: Request, res: Response) => {
  try {
    const { days } = reportQuery.parse(req.query);
    const analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8001";
    const response = await axios.get(`${analyticsServiceUrl}/analytics/peak-hours`, {
      params: { days: days ?? 30 },
      timeout: 30000,
    });
    res.json(response.data);
  } catch (e: any) {
    console.error("Peak hours error:", e.message);
    res.status(500).json({
      ok: false,
      error: e.message || "Failed to fetch peak hours",
    });
  }
});

/**
 * GET /api/analytics/frequent-visitors?limit=10&min_visits=2
 * Top frequent visitors
 */
const frequentQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  min_visits: z.coerce.number().int().min(1).optional(),
});

router.get("/frequent-visitors", async (req: Request, res: Response) => {
  try {
    const { limit, min_visits } = frequentQuery.parse(req.query);
    const analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8001";
    const response = await axios.get(`${analyticsServiceUrl}/analytics/frequent-visitors`, {
      params: { limit: limit ?? 10, min_visits: min_visits ?? 2 },
      timeout: 30000,
    });
    
    // Send notifications for repeated visit patterns
    const frequentVisitors = response.data.visitors || [];
    for (const visitor of frequentVisitors) {
      // Notify for visitors with high visit frequency (e.g., more than 5 visits)
      if ((visitor.visitCount || 0) >= 5) {
        notifyRepeatedVisits({
          name: visitor.name || 'Unknown',
          email: visitor.email || '',
          visitCount: visitor.visitCount || 0,
          frequency: visitor.visitFrequency || 0,
          lastVisit: visitor.lastVisit || new Date().toISOString(),
        }).catch((error) => {
          console.error('Failed to send repeated visits notification:', error);
        });
      }
    }
    
    res.json(response.data);
  } catch (e: any) {
    console.error("Frequent visitors error:", e.message);
    res.status(500).json({
      ok: false,
      error: e.message || "Failed to fetch frequent visitors",
    });
  }
});

/**
 * GET /api/analytics/suspicious-activity?threshold=0.05
 * Detect suspicious visitor patterns
 */
const suspiciousQuery = z.object({
  threshold: z.coerce.number().min(0.01).max(0.5).optional(),
});

router.get("/suspicious-activity", async (req: Request, res: Response) => {
  try {
    const { threshold } = suspiciousQuery.parse(req.query);
    const analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8001";
    const response = await axios.get(`${analyticsServiceUrl}/analytics/suspicious-activity`, {
      params: { threshold: threshold ?? 0.05 },
      timeout: 30000,
    });
    
    // Send notifications for suspicious activity
    const suspiciousVisitors = response.data.suspicious_visitors || [];
    for (const visitor of suspiciousVisitors) {
      // Build a descriptive reason from available fields
      const reasonDetails = [
        visitor.reason,
        `Visit count: ${visitor.visitCount || 0}`,
        `Failed verifications: ${visitor.failedVerifications || 0}`,
      ].filter(Boolean);
      
      notifySuspiciousActivity({
        name: visitor.name || 'Unknown',
        email: visitor.email || '',
        reason: reasonDetails.join(' | '),
        anomalyScore: visitor.suspicionScore || 0,
      }).catch((error) => {
        console.error('Failed to send suspicious activity notification:', error);
      });
    }
    
    res.json(response.data);
  } catch (e: any) {
    console.error("Suspicious activity error:", e.message);
    res.status(500).json({
      ok: false,
      error: e.message || "Failed to fetch suspicious activity",
    });
  }
});

/**
 * GET /api/analytics/trends?days=30
 * Visitor count trends
 */
router.get("/trends", async (req: Request, res: Response) => {
  try {
    const { days } = reportQuery.parse(req.query);
    const analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8001";
    const response = await axios.get(`${analyticsServiceUrl}/analytics/trends`, {
      params: { days: days ?? 30 },
      timeout: 30000,
    });
    res.json(response.data);
  } catch (e: any) {
    console.error("Trends error:", e.message);
    res.status(500).json({
      ok: false,
      error: e.message || "Failed to fetch trends",
    });
  }
});

export default router;
