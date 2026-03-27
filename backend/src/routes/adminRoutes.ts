import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAdminJwt, setAdminCookie, clearAdminCookie, signAdminJwt } from "../middleware/adminJwt.js";
import { safeCompare } from "../utils/crypto.js";
import { authConfig } from "../config.js";
import { logger } from "../utils/logger.js";

const router = Router();

// POST /api/admin/login { key: string }
router.post("/login", (req: Request, res: Response) => {
  const { key } = req.body as { key?: string };
  const configuredKey = authConfig.adminApiKey;

  if (!key || !configuredKey || !safeCompare(key, configuredKey)) {
    logger.warn({ ip: req.ip }, "Admin login failed: invalid key");
    return res.status(401).json({ message: "Invalid admin key" });
  }
  try {
    const token = signAdminJwt({ role: "admin" });
    setAdminCookie(res, token);
    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to login";
    return res.status(500).json({ message });
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

export default router;
