import "./config.js"; // Load env vars first
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import pinoHttpModule from "pino-http";
import path from "path";

// pino-http may export default or named depending on module resolution
const pinoHttp = (pinoHttpModule as any).default || pinoHttpModule;
import { randomUUID } from "crypto";
import { ensureDatabaseConnection, pool } from "./db/pool.js";
import { errorHandler } from "./middleware/errorHandler.js";
import visitorRoutes from "./routes/visitorRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import biometricRoutes from "./routes/biometricRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { logger } from "./utils/logger.js";
import { serverConfig } from "./config.js";
import type { IncomingMessage } from "http";

async function bootstrap() {
  const app = express();

  // ── Request ID & structured logging ──────────────────────────────
  app.use(
    pinoHttp({
      logger,
      genReqId: (req: IncomingMessage) => (req as any).id || randomUUID(),
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          // Don't log health/ready checks (noisy in k8s)
          const url = (req as any).originalUrl || (req as any).url || "";
          return url === "/health" || url === "/ready";
        },
      },
      customProps: (req: IncomingMessage) => ({
        requestId: (req as any).id,
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
  const apiLimiter = rateLimit({ windowMs: 60_000, max: 200 });
  app.use("/api", apiLimiter);

  // Registration-specific rate limit (more restrictive)
  const registrationLimiter = rateLimit({
    windowMs: 15 * 60_000,       // 15 minutes
    max: 30,                      // 30 registrations per window
    message: { message: "Too many registrations, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/visitors", registrationLimiter);

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

  // ── Health & readiness probes ────────────────────────────────────
  app.get("/health", (_req, res) => {
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
  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // ── Global error handler ─────────────────────────────────────────
  app.use(errorHandler);

  // ── Database connection with retry ───────────────────────────────
  await ensureDatabaseConnection();

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
