import { Router, Request, Response } from "express";
import { generateGeminiCompletion } from "../services/aiService.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import rateLimit from "express-rate-limit";

const router = Router();

// AI-specific rate limiter (expensive API calls)
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  message: { message: "Too many AI requests, please slow down" },
});

/**
 * POST /api/ai/generate
 * Body: { prompt: string }
 * Response: { enabled: boolean, output?: string, message?: string, error?: string, model?: string, usage?: {...} }
 * Requires admin authentication.
 */
router.post(
  "/generate",
  requireAdmin,
  aiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt } = req.body as { prompt?: string };
    const result = await generateGeminiCompletion(prompt ?? "");
    const status = result.error ? 400 : 200;
    res.status(status).json(result);
  })
);

export default router;
