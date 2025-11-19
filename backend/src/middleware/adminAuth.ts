import { NextFunction, Request, Response } from "express";

const headerName = "x-admin-key";

function extractProvidedKey(req: Request): string | null {
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
  const configuredKey = process.env.ADMIN_API_KEY;

  if (!configuredKey) {
    console.error("ADMIN_API_KEY is not configured; refusing admin request");
    res.status(500).json({ message: "Admin features are not configured" });
    return;
  }

  const provided = extractProvidedKey(req);
  if (!provided || provided !== configuredKey) {
    res.status(401).json({ message: "Invalid or missing admin key" });
    return;
  }

  next();
}
