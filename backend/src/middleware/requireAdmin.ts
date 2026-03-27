import { NextFunction, Request, Response } from "express";
import { verifyAdminJwt } from "./adminJwt.js";
import { extractProvidedKey } from "./adminAuth.js";
import { safeCompare } from "../utils/crypto.js";
import { logger } from "../utils/logger.js";
import { authConfig } from "../config.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // 1) Try JWT cookie first
  const cookieToken = req.cookies?.["admin_token"];
  if (cookieToken) {
    const decoded = verifyAdminJwt(cookieToken);
    if (decoded) {
      req.admin = decoded;
      next();
      return;
    }
  }

  // 2) Fallback to legacy header key
  const configuredKey = authConfig.adminApiKey;
  if (!configuredKey) {
    logger.warn({ ip: req.ip, url: req.originalUrl }, "Admin auth failed: ADMIN_API_KEY not configured");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const provided = extractProvidedKey(req);
  if (!provided || !safeCompare(provided, configuredKey)) {
    logger.warn({ ip: req.ip, url: req.originalUrl }, "Admin auth failed: invalid API key");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  // Set admin context for API key auth too
  req.admin = { role: "admin" };
  next();
}
