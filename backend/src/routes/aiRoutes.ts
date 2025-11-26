import { Router, Request, Response } from "express";
import { generateGeminiCompletion } from "../services/aiService.js";

const router = Router();

/**
 * POST /api/ai/generate
 * Body: { prompt: string }
 * Response: { enabled: boolean, output?: string, message?: string, error?: string, model?: string, usage?: {...} }
 */
router.post("/generate", async (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt?: string };
  const result = await generateGeminiCompletion(prompt ?? "");
  const status = result.error ? 400 : 200;
  return res.status(status).json(result);
});

export default router;
