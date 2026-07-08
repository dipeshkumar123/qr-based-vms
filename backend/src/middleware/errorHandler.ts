import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";
import { logger } from "../utils/logger.js";
import { ErrorCodes, sendApiError } from "../utils/errorCatalog.js";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.id as string | undefined;

  if (error instanceof HttpError) {
    return sendApiError(res, {
      status: error.status,
      message: error.message,
      code: error.code || ErrorCodes.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }

  if (error instanceof ZodError) {
    return sendApiError(res, {
      status: 400,
      message: "Validation failed",
      code: ErrorCodes.VALIDATION_FAILED,
      requestId,
      details: error.flatten(),
    });
  }

  // Handle malformed JSON body (SyntaxError from express.json())
  if (error instanceof SyntaxError && "body" in error) {
    return sendApiError(res, {
      status: 400,
      message: "Malformed JSON in request body",
      code: ErrorCodes.VALIDATION_MALFORMED_JSON,
      requestId,
    });
  }

  logger.error(
    { err: error, method: req.method, url: req.originalUrl, requestId },
    "Unexpected error"
  );

  return sendApiError(res, {
    status: 500,
    message: "Internal server error",
    code: ErrorCodes.INTERNAL_SERVER_ERROR,
    requestId,
  });
}
