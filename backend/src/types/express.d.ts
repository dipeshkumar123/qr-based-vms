import "express";
import "express-serve-static-core";

export interface AdminPayload {
  role: "admin";
  sub?: string;
  name?: string;
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
      
    }
  }
}
