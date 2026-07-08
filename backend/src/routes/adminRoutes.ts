import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAdminJwt, setAdminCookie, clearAdminCookie, signAdminJwt } from "../middleware/adminJwt.js";
import { safeCompare } from "../utils/crypto.js";
import { authConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { ErrorCodes, sendApiError } from "../utils/errorCatalog.js";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  DEFAULT_ALERT_THRESHOLDS,
  getAlertThresholds,
  saveAlertThresholds,
} from "../services/adminSettingsService.js";

const router = Router();
const adminLoginSchema = z.object({
  key: z.string().min(8).max(256),
}).strict();

const alertThresholdSchema = z.object({
  registrationBacklogRatio: z.number().min(0.05).max(0.95),
  lowTodayCheckInRate: z.number().min(0.05).max(0.95),
  activePopulationGap: z.number().int().min(1).max(200),
}).strict();

const exportTemplateSchema = z.object({
  templateId: z.enum(["analytics_summary", "analytics_trends", "audit_report"]),
});

const EXPORT_TEMPLATES: Record<string, { filename: string; csv: string; description: string }> = {
  analytics_summary: {
    filename: "analytics-summary-template.csv",
    description: "Summary metrics template for analytics exports",
    csv: "period_start,period_end,total_visits,avg_daily_visits,suspicious_count,peak_hour\n2026-04-01,2026-04-30,0,0,0,09:00\n",
  },
  analytics_trends: {
    filename: "analytics-trends-template.csv",
    description: "Daily trend line template",
    csv: "date,visitor_count,check_in_count,check_out_count\n2026-04-01,0,0,0\n",
  },
  audit_report: {
    filename: "audit-report-template.csv",
    description: "Audit integrity report template",
    csv: "generated_at,ledger_ok,total_entries,issue_count,notes\n2026-04-04T00:00:00Z,true,0,0,No integrity issues\n",
  },
};

// POST /api/admin/login { key: string }
router.post("/login", (req: Request, res: Response) => {
  const { key } = adminLoginSchema.parse(req.body);
  const configuredKey = authConfig.adminApiKey;

  if (!key || !configuredKey || !safeCompare(key, configuredKey)) {
    logger.warn({ ip: req.ip }, "Admin login failed: invalid key");
    return sendApiError(res, {
      status: 401,
      message: "Invalid admin key",
      code: ErrorCodes.AUTH_INVALID_ADMIN_KEY,
      requestId: (req.id as string),
    });
  }
  try {
    const token = signAdminJwt({ role: "admin", sub: "admin", name: "Administrator" });
    setAdminCookie(res, token);
    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    logger.error({ err: e }, "Admin login failed unexpectedly");
    return sendApiError(res, {
      status: 500,
      message: "Failed to login",
      code: ErrorCodes.ADMIN_LOGIN_FAILED,
      requestId: (req.id as string),
    });
  }
});

// POST /api/admin/logout
router.post("/logout", (_req: Request, res: Response) => {
  clearAdminCookie(res);
  return res.status(204).send();
});

// GET /api/admin/verify - succeed if either JWT cookie or legacy key provided
router.get("/verify", requireAdmin, (_req: Request, res: Response) => {
  return res.status(204).send();
});

// JWT-only protected example
router.get("/me", requireAdminJwt, (req: Request, res: Response) => {
  return res.json({ role: req.admin?.role || "admin" });
});

router.get("/alert-thresholds", requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const thresholds = await getAlertThresholds();
  res.json({ thresholds });
}));

router.put("/alert-thresholds", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const parsed = alertThresholdSchema.parse(req.body);
  const next = {
    registrationBacklogRatio: Number(parsed.registrationBacklogRatio),
    lowTodayCheckInRate: Number(parsed.lowTodayCheckInRate),
    activePopulationGap: Number(parsed.activePopulationGap),
  };
  const saved = await saveAlertThresholds(next);
  res.json({ ok: true, thresholds: saved, defaults: DEFAULT_ALERT_THRESHOLDS });
}));

router.get("/export-templates", requireAdmin, (_req: Request, res: Response) => {
  const templates = Object.entries(EXPORT_TEMPLATES).map(([id, item]) => ({
    id,
    filename: item.filename,
    description: item.description,
  }));
  res.json({ templates });
});

router.get("/export-template/:templateId", requireAdmin, (req: Request, res: Response) => {
  const { templateId } = exportTemplateSchema.parse(req.params);
  const selected = EXPORT_TEMPLATES[templateId];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${selected.filename}\"`);
  res.send(selected.csv);
});

export default router;
