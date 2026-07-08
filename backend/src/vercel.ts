import "./config.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import pinoHttpModule from "pino-http";
import { randomUUID } from "crypto";
import { errorHandler } from "./middleware/errorHandler.js";
import visitorRoutes from "./routes/visitorRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import biometricRoutes from "./routes/biometricRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { logger } from "./utils/logger.js";
import { serverConfig } from "./config.js";
import { ErrorCodes, sendApiError } from "./utils/errorCatalog.js";
import type { IncomingMessage } from "http";

const pinoHttp = (pinoHttpModule as any).default || pinoHttpModule;
const app = express();

app.use(
  pinoHttp({
    logger,
    genReqId: (req: IncomingMessage) => {
      const expressReq = req as express.Request;
      const incoming = expressReq.headers?.["x-request-id"];
      if (typeof incoming === "string" && incoming.trim()) return incoming.trim();
      return expressReq.id || randomUUID();
    },
  })
);

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

// Rate Limiters
const apiLimiter = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api", apiLimiter);

app.get(["/health", "/api/health"], (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/admin", adminRoutes);
app.use("/api", visitorRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/biometric", biometricRoutes);
app.use("/api", uploadRoutes);

app.use((req, res) => {
  sendApiError(res, {
    status: 404,
    message: "Not found",
    code: ErrorCodes.ROUTE_NOT_FOUND,
    requestId: (req.id as string),
  });
});

app.use(errorHandler);

export default app;
