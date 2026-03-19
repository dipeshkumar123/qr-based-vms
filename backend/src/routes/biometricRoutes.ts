import { Router, Request, Response } from "express";
import fetch from "node-fetch";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { notifyFailedVerification } from "../services/notificationService.js";
import { pool } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { servicesConfig } from "../config.js";

const router = Router();

const BIOMETRIC_SERVICE_URL = servicesConfig.biometricUrl;
const BIOMETRIC_TIMEOUT_MS = 30_000;

// Rate limit on verification endpoint (brute-force protection)
const verifyLimiter = rateLimit({
  windowMs: 5 * 60_000,    // 5 minutes
  max: 20,                  // 20 attempts per window
  message: { message: "Too many verification attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas — photo_base64 now has max length (10MB base64 ≈ 13.3M chars)
const capturePhotoSchema = z.object({
  visitor_id: z.number().int().positive(),
  photo_base64: z.string().min(100).max(15_000_000),
});

const verifyPhotoSchema = z.object({
  visitor_id: z.number().int().positive(),
  photo_base64: z.string().min(100).max(15_000_000),
  match_threshold: z.number().min(0).max(1).optional(),
});

// Helper to call biometric service with timeout
async function callBiometricService(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "POST",
  body?: any
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BIOMETRIC_TIMEOUT_MS);

  try {
    const url = `${BIOMETRIC_SERVICE_URL}${endpoint}`;
    const options: any = {
      method,
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new HttpError(response.status, `Biometric service error: ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof HttpError) throw error;
    if (error.name === "AbortError") {
      throw new HttpError(504, "Biometric service timed out");
    }
    throw new HttpError(503, `Biometric service unavailable: ${error.message}`);
  }
}

/**
 * GET /api/biometric/health
 * Check biometric service health
 */
router.get("/health", asyncHandler(async (_req: Request, res: Response) => {
  const result = await callBiometricService("/health", "GET");
  res.json(result);
}));

/**
 * POST /api/biometric/capture
 * Capture and store visitor face encoding
 */
router.post("/capture", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { visitor_id, photo_base64 } = capturePhotoSchema.parse(req.body);
  const result = await callBiometricService("/capture", "POST", {
    visitor_id,
    photo_base64,
  });
  res.json(result);
}));

/**
 * POST /api/biometric/verify
 * Verify if photo matches stored encoding
 */
router.post("/verify", verifyLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { visitor_id, photo_base64, match_threshold } = verifyPhotoSchema.parse(
    req.body
  );
  const result = await callBiometricService("/verify", "POST", {
    visitor_id,
    photo_base64,
    match_threshold,
  });
  
  // Send notification if verification failed (fix: result.is_match, not result.match)
  if (result.success && !result.is_match) {
    const visitorResult = await pool.query(
      `SELECT name, email, phone FROM visitors WHERE id = $1`,
      [visitor_id]
    );
    
    if (visitorResult.rows.length > 0) {
      const visitor = visitorResult.rows[0];
      notifyFailedVerification({
        name: visitor.name,
        email: visitor.email,
        phone: visitor.phone,
      }).catch((error) => {
        logger.error({ err: error }, 'Failed to send verification failure notification');
      });
    }
  }
  
  res.json(result);
}));

/**
 * GET /api/biometric/info/:visitor_id
 * Check if visitor has stored face encoding
 */
router.get("/info/:visitor_id", asyncHandler(async (req: Request, res: Response) => {
  const visitor_id = Number(req.params.visitor_id);
  if (Number.isNaN(visitor_id)) {
    throw new HttpError(400, "Valid visitor_id required");
  }
  const result = await callBiometricService(`/info/${visitor_id}`, "GET");
  res.json(result);
}));

/**
 * DELETE /api/biometric/encoding/:visitor_id (admin only)
 * Delete all stored biometric data for visitor
 */
router.delete(
  "/encoding/:visitor_id",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const visitor_id = Number(req.params.visitor_id);
    if (Number.isNaN(visitor_id)) {
      throw new HttpError(400, "Valid visitor_id required");
    }
    const result = await callBiometricService(`/encoding/${visitor_id}`, "DELETE");
    res.json(result);
  })
);

/**
 * GET /api/biometric/stats
 * Get biometric service storage statistics (admin only)
 */
router.get("/stats", requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const result = await callBiometricService("/stats", "GET");
  res.json(result);
}));

export default router;
