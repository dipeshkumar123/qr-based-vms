import "express";

export interface AdminPayload {
  role: "admin";
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Admin JWT payload (set by auth middleware) */
      admin?: AdminPayload;
      /** Unique request ID for tracing/correlation */
      id?: string;
    }
  }
}
