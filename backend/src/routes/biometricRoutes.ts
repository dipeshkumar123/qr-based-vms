import { Router, Request, Response, NextFunction } from "express";
import fetch from "node-fetch";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { notifyFailedVerification } from "../services/notificationService.js";
import { pool } from "../db/pool.js";

const router = Router();

const BIOMETRIC_SERVICE_URL = process.env.BIOMETRIC_SERVICE_URL || "http://localhost:8000";

// Validation schemas
const capturePhotoSchema = z.object({
  visitor_id: z.number().int().positive(),
  photo_base64: z.string().min(100),
});

const verifyPhotoSchema = z.object({
  visitor_id: z.number().int().positive(),
  photo_base64: z.string().min(100),
  match_threshold: z.number().min(0).max(1).optional(),
});

// Helper to call biometric service
async function callBiometricService(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "POST",
  body?: any
): Promise<any> {
  try {
    const url = `${BIOMETRIC_SERVICE_URL}${endpoint}`;
    const options: any = {
      method,
      headers: { "Content-Type": "application/json" },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new HttpError(response.status, `Biometric service error: ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, `Biometric service unavailable: ${error.message}`);
  }
}

/**
 * GET /api/biometric/health
 * Check biometric service health
 */
router.get("/health", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await callBiometricService("/health", "GET");
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/biometric/capture
 * Capture and store visitor face encoding
 */
router.post("/capture", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { visitor_id, photo_base64 } = capturePhotoSchema.parse(req.body);
    const result = await callBiometricService("/capture", "POST", {
      visitor_id,
      photo_base64,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/biometric/verify
 * Verify if photo matches stored encoding
 */
router.post("/verify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { visitor_id, photo_base64, match_threshold } = verifyPhotoSchema.parse(
      req.body
    );
    const result = await callBiometricService("/verify", "POST", {
      visitor_id,
      photo_base64,
      match_threshold,
    });
    
    // Send notification if verification failed
    if (!result.match) {
      // Get visitor details
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
          console.error('Failed to send verification failure notification:', error);
        });
      }
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/biometric/info/:visitor_id
 * Check if visitor has stored face encoding
 */
router.get("/info/:visitor_id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visitor_id = Number(req.params.visitor_id);
    if (Number.isNaN(visitor_id)) {
      throw new HttpError(400, "Valid visitor_id required");
    }
    const result = await callBiometricService(`/info/${visitor_id}`, "GET");
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/biometric/encoding/:visitor_id (admin only)
 * Delete all stored biometric data for visitor
 */
router.delete(
  "/encoding/:visitor_id",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const visitor_id = Number(req.params.visitor_id);
      if (Number.isNaN(visitor_id)) {
        throw new HttpError(400, "Valid visitor_id required");
      }
      const result = await callBiometricService(`/encoding/${visitor_id}`, "DELETE");
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
