import { Router, Request, Response } from "express";
import { recordEvent } from "../services/analyticsService.js";

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

export default router;
