/**
 * testApp.ts
 * Builds a fully-configured Express app for integration tests WITHOUT
 * touching the real database or external services.  The DB pool is
 * replaced by a vi.mock in each test file; this helper just wires up
 * the same middleware/route stack that production uses.
 */
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import { errorHandler } from "../../middleware/errorHandler.js";
import visitorRoutes from "../../routes/visitorRoutes.js";
import adminRoutes from "../../routes/adminRoutes.js";
import { ErrorCodes, sendApiError } from "../../utils/errorCatalog.js";

export function buildTestApp() {
  const app = express();

  // Minimal request-id injection (no pino-http noise in tests)
  app.use((req, _res, next) => {
    (req as any).id = req.headers["x-request-id"] ?? randomUUID();
    next();
  });

  app.use(cors({ credentials: true }));
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Health stub so we can verify the app starts
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // API routes (same as production)
  app.use("/api/admin", adminRoutes);
  app.use("/api", visitorRoutes);

  // 404
  app.use((req, res) => {
    sendApiError(res, {
      status: 404,
      message: "Not found",
      code: ErrorCodes.ROUTE_NOT_FOUND,
      requestId: (req as any).id,
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
