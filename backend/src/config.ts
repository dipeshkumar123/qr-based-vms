import dotenv from "dotenv";
import { resolveSecret } from "./utils/secrets.js";

// Load env vars once at the entry point
dotenv.config();

/** Server configuration */
export const serverConfig = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: (process.env.NODE_ENV || "development").toLowerCase().trim(),
  get isProd() {
    return this.nodeEnv === "production";
  },
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : ["http://localhost:5173", "http://localhost:5174"],
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  uploadDir: process.env.UPLOAD_DIR || (process.env.VERCEL ? "/tmp/uploads" : "uploads"),
  logLevel: process.env.LOG_LEVEL ?? "info",
} as const;

/** Database configuration */
export const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  requiredSchemaVersion: process.env.DB_SCHEMA_VERSION || "2026.04.05.1",
  poolMax: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeoutMs: 30_000,
  connectionTimeoutMs: 5_000,
  statementTimeoutMs: 30_000,
  slowQueryMs: parseInt(process.env.DB_SLOW_QUERY_MS || "300", 10),
  retryAttempts: 5,
  retryDelayMs: 2_000,
} as const;

/** Admin / Auth configuration */
export const authConfig = {
  adminApiKey: resolveSecret("ADMIN_API_KEY"),
  jwtSecret: resolveSecret("ADMIN_JWT_SECRET"),
  jwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "2h",
  jwtAlgorithm: "HS256" as const,
  jwtIssuer: "ii-vms",
  jwtAudience: "ii-vms-admin",
} as const;

/** External service URLs */
export const servicesConfig = {
  biometricUrl: process.env.BIOMETRIC_SERVICE_URL || "http://localhost:8000",
  analyticsUrl: process.env.ANALYTICS_SERVICE_URL || "http://localhost:8001",
  /** Service-to-service API key for internal calls (biometric/analytics → backend) */
  serviceApiKey: resolveSecret("SERVICE_API_KEY"),
} as const;

/** Upstream protection configuration */
export const upstreamConfig = {
  circuitBreaker: {
    failureThreshold: Number(process.env.UPSTREAM_CB_FAILURE_THRESHOLD ?? 5),
    resetTimeoutMs: Number(process.env.UPSTREAM_CB_RESET_TIMEOUT_MS ?? 30_000),
    halfOpenSuccesses: Number(process.env.UPSTREAM_CB_HALF_OPEN_SUCCESSES ?? 2),
  },
} as const;

/** Biometric graceful fallback policy */
export const biometricFallbackConfig = {
  enabled: (process.env.BIOMETRIC_FALLBACK_ENABLED ?? "true").toLowerCase() === "true",
  mode: (process.env.BIOMETRIC_FALLBACK_MODE ?? "manual_review_required") as
    | "manual_review_required"
    | "allow_qr_check_in",
  retryAfterSeconds: Number(process.env.BIOMETRIC_FALLBACK_RETRY_AFTER_SECONDS ?? 30),
} as const;

/** Analytics ingestion reliability monitor configuration */
export const analyticsReliabilityConfig = {
  enabled: (process.env.ANALYTICS_RELIABILITY_ENABLED ?? "false").toLowerCase() === "true",
  pollIntervalMs: Number(process.env.ANALYTICS_RELIABILITY_POLL_MS ?? 15000),
  degradedChecksToAlert: Number(process.env.ANALYTICS_RELIABILITY_DEGRADED_CHECKS ?? 2),
  healthyChecksToRecover: Number(process.env.ANALYTICS_RELIABILITY_HEALTHY_CHECKS ?? 2),
  alertCooldownMs: Number(process.env.ANALYTICS_RELIABILITY_ALERT_COOLDOWN_MS ?? 300000),
  bufferAlertThreshold: Number(process.env.ANALYTICS_RELIABILITY_BUFFER_THRESHOLD ?? 100),
  failureAlertThreshold: Number(process.env.ANALYTICS_RELIABILITY_FAILURE_THRESHOLD ?? 3),
} as const;

/** Gemini AI configuration */
export const geminiConfig = {
  enabled: (process.env.GEMINI_ENABLED ?? "false").toLowerCase() === "true",
  apiKey: resolveSecret("GEMINI_API_KEY"),
  model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 12000),
  maxPromptChars: Number(process.env.GEMINI_MAX_PROMPT_CHARS ?? 8000),
} as const;

/** Notification configuration */
export const notificationConfig = {
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: resolveSecret("SMTP_PASS"),
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: resolveSecret("TWILIO_AUTH_TOKEN"),
    fromNumber: process.env.TWILIO_PHONE_NUMBER || "",
  },
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPhone: process.env.ADMIN_PHONE || "",
  enableSmsAlerts: process.env.ENABLE_SMS_ALERTS === "true",
} as const;

const INSECURE_SECRET_VALUES = new Set([
  "change-me-very-strong",
  "change-me-super-secret",
  "change-this-to-a-secure-random-string",
  "change-this-to-a-strong-jwt-secret",
  "your-app-password",
  "your-twilio-auth-token",
  "replace-with-random-service-key",
]);

export function getSecretHygieneWarnings(): string[] {
  const warnings: string[] = [];

  const checks: Array<{ label: string; value: string; minLength: number }> = [
    { label: "ADMIN_API_KEY", value: authConfig.adminApiKey, minLength: 16 },
    { label: "ADMIN_JWT_SECRET", value: authConfig.jwtSecret, minLength: 24 },
  ];

  if (servicesConfig.serviceApiKey) {
    checks.push({ label: "SERVICE_API_KEY", value: servicesConfig.serviceApiKey, minLength: 24 });
  }

  for (const check of checks) {
    const normalized = check.value.trim();
    if (!normalized) {
      warnings.push(`${check.label} is missing`);
      continue;
    }
    if (INSECURE_SECRET_VALUES.has(normalized.toLowerCase())) {
      warnings.push(`${check.label} uses placeholder value`);
      continue;
    }
    if (normalized.length < check.minLength) {
      warnings.push(`${check.label} is shorter than ${check.minLength} characters`);
    }
  }

  return warnings;
}
