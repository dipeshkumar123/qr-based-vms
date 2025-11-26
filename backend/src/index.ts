import cors from "cors";
import express from "express";
import { ensureDatabaseConnection } from "./db/pool.js";
import { errorHandler } from "./middleware/errorHandler.js";
import visitorRoutes from "./routes/visitorRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";

type ServerConfig = {
  port: number;
  corsOrigin: string | RegExp | (string | RegExp)[] | undefined;
};

function buildConfig(): ServerConfig {
  const port = Number(process.env.PORT ?? 4000);
  const corsOrigin = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ["http://localhost:5173", "http://localhost:5174"];
  return { port, corsOrigin };
}

async function bootstrap() {
  const app = express();
  const config = buildConfig();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  if (!process.env.ADMIN_API_KEY) {
    console.warn("ADMIN_API_KEY is not set; admin endpoints will be disabled.");
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", visitorRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use(errorHandler);

  await ensureDatabaseConnection();
  app.listen(config.port, () => {
    console.log(`II-VMS backend running on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
