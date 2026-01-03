import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error instanceof ZodError) {
    return res.status(400).json({ message: "Validation failed", issues: error.flatten() });
  }

  console.error("Unexpected error", error);
  return res.status(500).json({ message: "Internal server error" });
}
