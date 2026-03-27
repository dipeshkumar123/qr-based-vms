import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";
import { logger } from "../utils/logger.js";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as any).id as string | undefined;

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      message: error.message,
      ...(requestId && { requestId }),
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      issues: error.flatten(),
      ...(requestId && { requestId }),
    });
  }

  // Handle malformed JSON body (SyntaxError from express.json())
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      message: "Malformed JSON in request body",
      ...(requestId && { requestId }),
    });
  }

  logger.error(
    { err: error, method: req.method, url: req.originalUrl, requestId },
    "Unexpected error"
  );

  return res.status(500).json({
    message: "Internal server error",
    ...(requestId && { requestId }),
  });
}
