import "./config.js"; // Load env vars first
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import pinoHttpModule from "pino-http";
import path from "path";

// pino-http may export default or named depending on module resolution
const pinoHttp = (pinoHttpModule as any).default || pinoHttpModule;
import { randomUUID } from "crypto";
import { ensureDatabaseConnection, pool, validateDatabaseSchema } from "./db/pool.js";
import { errorHandler } from "./middleware/errorHandler.js";
import visitorRoutes from "./routes/visitorRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import biometricRoutes from "./routes/biometricRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { logger } from "./utils/logger.js";
import { getSecretHygieneWarnings, serverConfig, servicesConfig } from "./config.js";
import { ErrorCodes, sendApiError } from "./utils/errorCatalog.js";
import type { IncomingMessage } from "http";

async function bootstrap() {
  const app = express();

  // ── Request ID & structured logging ──────────────────────────────
  app.use(
    pinoHttp({
      logger,
      genReqId: (req: IncomingMessage) => {
        const expressReq = req as express.Request;
        const incoming = expressReq.headers?.["x-request-id"];
        if (typeof incoming === "string" && incoming.trim()) return incoming.trim();
        return expressReq.id || randomUUID();
      },
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          // Don't log health/ready checks (noisy in k8s)
          const expressReq = req as express.Request;
          const url = expressReq.originalUrl || expressReq.url || "";
          return url === "/health" || url === "/ready";
        },
      },
      customProps: (req: IncomingMessage) => ({
        requestId: (req as express.Request).id,
      }),
    })
  );

  // ── Security & parsing ───────────────────────────────────────────
  app.use(
    cors({
      origin: serverConfig.corsOrigin,
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // ── Rate limiting ────────────────────────────────────────────────
  const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", apiLimiter);

  // Registration-specific rate limit (more restrictive)
  const registrationLimiter = rateLimit({
    windowMs: 15 * 60_000,       // 15 minutes
    max: 30,                      // 30 registrations per window
    message: { message: "Too many registrations, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const registrationOnlyLimiter: RequestHandler = (req, res, next) => {
    // Apply strict throttling only to public registration endpoint: POST /api/visitors
    if (req.method === "POST" && req.path === "/") {
      registrationLimiter(req, res, next);
      return;
    }
    next();
  };
  app.use("/api/visitors", registrationOnlyLimiter);

  // Admin login rate limit (brute-force protection)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    message: { message: "Too many login attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/admin/login", loginLimiter);

  if (!serverConfig.isProd && !process.env.ADMIN_API_KEY) {
    logger.warn("ADMIN_API_KEY is not set; admin endpoints will be disabled.");
  }

  const secretWarnings = getSecretHygieneWarnings();
  if (secretWarnings.length > 0) {
    if (serverConfig.isProd) {
      logger.fatal({ warnings: secretWarnings }, "Secret hygiene check failed in production");
      process.exit(1);
    }
    logger.warn({ warnings: secretWarnings }, "Secret hygiene warnings detected");
  }

  // ── Health & readiness probes ────────────────────────────────────
  app.get(["/health", "/api/health"], (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/ready", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "degraded" });
    }
  });

  app.get("/health/dependencies", async (_req, res) => {
    const check = async (name: string, fn: () => Promise<void>) => {
      const startedAt = Date.now();
      try {
        await fn();
        return { name, ok: true, latencyMs: Date.now() - startedAt };
      } catch (error) {
        return {
          name,
          ok: false,
          latencyMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : "unknown error",
        };
      }
    };

    const analyticsUrl = `${servicesConfig.analyticsUrl}/health`;
    const biometricUrl = `${servicesConfig.biometricUrl}/health`;

    const [db, analytics, biometric] = await Promise.all([
      check("database", async () => {
        await pool.query("SELECT 1");
      }),
      check("analytics", async () => {
        const r = await fetch(analyticsUrl, {
          headers: servicesConfig.serviceApiKey ? { "x-service-key": servicesConfig.serviceApiKey } : undefined,
        });
        if (!r.ok) throw new Error(`status ${r.status}`);
      }),
      check("biometric", async () => {
        const r = await fetch(biometricUrl, {
          headers: servicesConfig.serviceApiKey ? { "x-service-key": servicesConfig.serviceApiKey } : undefined,
        });
        if (!r.ok) throw new Error(`status ${r.status}`);
      }),
    ]);

    const checks = [db, analytics, biometric];
    const ok = checks.every((c) => c.ok);
    res.status(ok ? 200 : 503).json({ status: ok ? "healthy" : "degraded", checks });
  });

  // ── Static file serving for uploads ──────────────────────────────
  const uploadDir = path.resolve(serverConfig.uploadDir);
  app.use("/uploads", express.static(uploadDir));

  // ── API routes ───────────────────────────────────────────────────
  app.use("/api/admin", adminRoutes);
  app.use("/api", visitorRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/biometric", biometricRoutes);
  app.use("/api", uploadRoutes);

  // ── 404 handler for unmatched routes ─────────────────────────────
  app.use((req, res) => {
    sendApiError(res, {
      status: 404,
      message: "Not found",
      code: ErrorCodes.ROUTE_NOT_FOUND,
      requestId: (req.id as string),
    });
  });

  // ── Global error handler ─────────────────────────────────────────
  app.use(errorHandler);

  // ── Database connection with retry ───────────────────────────────
  await ensureDatabaseConnection();
  const schema = await validateDatabaseSchema();
  if (!schema.ok) {
    logger.fatal({ missing: schema.missing }, "Required database schema is missing. Run migrations before starting backend.");
    process.exit(1);
  }

  const server = app.listen(serverConfig.port, () => {
    logger.info(`II-VMS backend running on port ${serverConfig.port} (${serverConfig.nodeEnv})`);
  });

  // ── Graceful shutdown ────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);

    // Stop accepting new connections
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    logger.info("HTTP server closed");

    // Drain the database pool
    await pool.end();
    logger.info("Database pool closed");

    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle unhandled rejections gracefully
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
  });
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, "Failed to start server");
  process.exit(1);
});
