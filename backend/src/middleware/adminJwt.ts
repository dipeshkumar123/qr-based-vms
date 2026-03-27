import { NextFunction, Request, Response } from "express";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { AdminPayload } from "../types/express.js";
import { authConfig, serverConfig } from "../config.js";

const COOKIE_NAME = "admin_token";

export function signAdminJwt(payload: object, expiresIn?: string | number): string {
  if (!authConfig.jwtSecret) throw new Error("ADMIN_JWT_SECRET not set");
  const secret: Secret = authConfig.jwtSecret;
  const options: SignOptions = {
    expiresIn: (expiresIn || authConfig.jwtExpiresIn) as SignOptions["expiresIn"],
    algorithm: authConfig.jwtAlgorithm,
    issuer: authConfig.jwtIssuer,
    audience: authConfig.jwtAudience,
  };
  return jwt.sign(payload, secret, options);
}

export function verifyAdminJwt(token: string): AdminPayload | null {
  if (!authConfig.jwtSecret) return null;
  try {
    return jwt.verify(token, authConfig.jwtSecret, {
      algorithms: [authConfig.jwtAlgorithm],
      issuer: authConfig.jwtIssuer,
      audience: authConfig.jwtAudience,
    }) as AdminPayload;
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
  req.admin = decoded;
  next();
}

export function setAdminCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: serverConfig.isProd ? "none" : "lax",
    secure: serverConfig.isProd,
    maxAge: 1000 * 60 * 60 * 2,
    path: "/",
  });
}

export function clearAdminCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: serverConfig.isProd ? "none" : "lax",
    secure: serverConfig.isProd,
    path: "/",
  });
}
