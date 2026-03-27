import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { safeCompare } from "../utils/crypto.js";
import { authConfig } from "../config.js";

const headerName = "x-admin-key";

export function extractProvidedKey(req: Request): string | null {
  const headerKey = req.header(headerName);
  if (headerKey) {
    return headerKey.trim();
  }

  const authHeader = req.header("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = authConfig.adminApiKey;

  if (!configuredKey) {
    logger.error("ADMIN_API_KEY is not configured; refusing admin request");
    res.status(500).json({ message: "Admin features are not configured" });
    return;
  }

  const provided = extractProvidedKey(req);
  if (!provided || !safeCompare(provided, configuredKey)) {
    logger.warn({ ip: req.ip, url: req.originalUrl }, "Admin key auth failed");
    res.status(401).json({ message: "Invalid or missing admin key" });
    return;
  }

  req.admin = { role: "admin" };
  next();
}
