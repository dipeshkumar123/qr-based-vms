import { NextFunction, Request, Response } from "express";
import jwt, { Secret, SignOptions } from "jsonwebtoken";

const COOKIE_NAME = "admin_token";

export function signAdminJwt(payload: object, expiresIn: string | number = "2h"): string {
  const secret: Secret | undefined = process.env.ADMIN_JWT_SECRET as unknown as Secret;
  if (!secret) throw new Error("ADMIN_JWT_SECRET not set");
  return jwt.sign(payload as any, secret, { expiresIn } as SignOptions);
}

export function verifyAdminJwt(token: string): any | null {
  const secret: Secret | undefined = process.env.ADMIN_JWT_SECRET as unknown as Secret;
  if (!secret) return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

export function requireAdminJwt(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const decoded = verifyAdminJwt(token);
  if (!decoded) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  (req as any).admin = decoded;
  next();
}

export function setAdminCookie(res: Response, token: string): void {
  const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 2,
    path: "/",
  });
}

export function clearAdminCookie(res: Response): void {
  const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
  });
}
