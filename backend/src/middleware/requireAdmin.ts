import { NextFunction, Request, Response } from "express";
import { verifyAdminJwt } from "./adminJwt.js";

const headerName = "x-admin-key";

function extractProvidedKey(req: Request): string | null {
  const headerKey = req.header(headerName);
  if (headerKey) return headerKey.trim();
  const authHeader = req.header("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // 1) Try JWT cookie first
  const cookieToken = (req as any).cookies?.["admin_token"] || req.cookies?.["admin_token"]; // cookie-parser
  if (cookieToken) {
    const decoded = verifyAdminJwt(cookieToken);
    if (decoded) {
      (req as any).admin = decoded;
      next();
      return;
    }
  }

  // 2) Fallback to legacy header key
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const provided = extractProvidedKey(req);
  if (!provided || provided !== configuredKey) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}
