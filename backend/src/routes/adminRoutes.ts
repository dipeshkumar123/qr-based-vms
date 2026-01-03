import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAdminJwt, setAdminCookie, clearAdminCookie, signAdminJwt } from "../middleware/adminJwt.js";

const router = Router();

// POST /api/admin/login { key: string }
router.post("/login", (req: Request, res: Response) => {
  const { key } = req.body as { key?: string };
  const configuredKey = process.env.ADMIN_API_KEY || "";
  if (!key || key !== configuredKey) {
    return res.status(401).json({ message: "Invalid admin key" });
  }
  try {
    const token = signAdminJwt({ role: "admin" }, process.env.ADMIN_JWT_EXPIRES_IN || "2h");
    setAdminCookie(res, token);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to login" });
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
router.get("/me", requireAdminJwt, (_req: Request, res: Response) => {
  return res.json({ role: "admin" });
});

export default router;
