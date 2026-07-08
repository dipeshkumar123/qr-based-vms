import dotenv from "dotenv";

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
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  logLevel: process.env.LOG_LEVEL ?? "info",
} as const;

/** Database configuration */
export const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  poolMax: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeoutMs: 30_000,
  connectionTimeoutMs: 5_000,
  statementTimeoutMs: 30_000,
  retryAttempts: 5,
  retryDelayMs: 2_000,
} as const;

/** Admin / Auth configuration */
export const authConfig = {
  adminApiKey: process.env.ADMIN_API_KEY || "",
  jwtSecret: process.env.ADMIN_JWT_SECRET || "",
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
  serviceApiKey: process.env.SERVICE_API_KEY || "",
} as const;

/** Gemini AI configuration */
export const geminiConfig = {
  enabled: (process.env.GEMINI_ENABLED ?? "false").toLowerCase() === "true",
  apiKey: process.env.GEMINI_API_KEY || "",
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
    pass: process.env.SMTP_PASS || "",
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    fromNumber: process.env.TWILIO_PHONE_NUMBER || "",
  },
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPhone: process.env.ADMIN_PHONE || "",
  enableSmsAlerts: process.env.ENABLE_SMS_ALERTS === "true",
} as const;

/** Analytics reliability monitoring configuration */
export const analyticsReliabilityConfig = {
  enabled: (process.env.ANALYTICS_RELIABILITY_ENABLED ?? "false").toLowerCase() === "true",
  pollIntervalMs: Number(process.env.ANALYTICS_RELIABILITY_POLL_INTERVAL_MS ?? 30000),
  bufferAlertThreshold: Number(process.env.ANALYTICS_BUFFER_ALERT_THRESHOLD ?? 1000),
  failureAlertThreshold: Number(process.env.ANALYTICS_FAILURE_ALERT_THRESHOLD ?? 5),
  degradedChecksToAlert: Number(process.env.ANALYTICS_DEGRADED_CHECKS_TO_ALERT ?? 3),
  healthyChecksToRecover: Number(process.env.ANALYTICS_HEALTHY_CHECKS_TO_RECOVER ?? 3),
  alertCooldownMs: Number(process.env.ANALYTICS_ALERT_COOLDOWN_MS ?? 3600000),
} as const;