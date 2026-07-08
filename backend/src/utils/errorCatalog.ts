import type { Response } from "express";

export const ErrorCodes = {
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  AUTH_INVALID_ADMIN_KEY: "AUTH_INVALID_ADMIN_KEY",
  AUTH_NOT_CONFIGURED: "AUTH_NOT_CONFIGURED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  VALIDATION_MALFORMED_JSON: "VALIDATION_MALFORMED_JSON",
  VALIDATION_MISSING_QR_TOKEN: "VALIDATION_MISSING_QR_TOKEN",
  VALIDATION_INVALID_VISITOR_ID: "VALIDATION_INVALID_VISITOR_ID",
  VALIDATION_FILE_REQUIRED: "VALIDATION_FILE_REQUIRED",
  IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED",
  IDEMPOTENCY_DUPLICATE_IN_FLIGHT: "IDEMPOTENCY_DUPLICATE_IN_FLIGHT",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  ADMIN_LOGIN_FAILED: "ADMIN_LOGIN_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

type SendApiErrorInput = {
  status: number;
  message: string;
  code: ErrorCode | string;
  requestId?: string;
  details?: unknown;
};

export function sendApiError(res: Response, input: SendApiErrorInput) {
  const body: Record<string, unknown> = {
    message: input.message,
    code: input.code,
  };
  if (input.requestId) body.requestId = input.requestId;
  if (input.details !== undefined) body.details = input.details;
  return res.status(input.status).json(body);
}
