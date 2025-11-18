import cors from "cors";
import express from "express";
import { ensureDatabaseConnection } from "./db/pool.js";
import { errorHandler } from "./middleware/errorHandler.js";
import visitorRoutes from "./routes/visitorRoutes.js";

type ServerConfig = {
  port: number;
  corsOrigin: string | RegExp | (string | RegExp)[] | undefined;
};

function buildConfig(): ServerConfig {
  const port = Number(process.env.PORT ?? 4000);
  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  return { port, corsOrigin };
}

async function bootstrap() {
  const app = express();
  const config = buildConfig();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", visitorRoutes);
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
