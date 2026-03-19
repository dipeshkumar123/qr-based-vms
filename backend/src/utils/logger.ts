import pino from "pino";
import { serverConfig } from "../config.js";

export const logger = pino({
  level: serverConfig.logLevel,
  // Redact sensitive fields from logs
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers['x-admin-key']",
      "req.headers.cookie",
      "password",
      "key",
      "token",
      "secret",
      "apiKey",
    ],
    censor: "[REDACTED]",
  },
  // Add base fields
  base: { service: "ii-vms-backend" },
  // Pretty print in development
  transport: !serverConfig.isProd
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});

/**
 * Create a child logger with request context for correlation.
 */
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
