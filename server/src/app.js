import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import healthRoutes from "./modules/health.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import projectRoutes from "./modules/projects/project.routes.js";
import tutorRoutes from "./modules/tutor/tutor.routes.js";
import learningRoutes from "./modules/learning/learning.routes.js";
import { csrfGuard } from "./middleware/csrf.js";
import { requireDb } from "./middleware/requireDb.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan("dev"));

  app.use(
    "/api",
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false })
  );

  app.use("/api", csrfGuard);

  app.use("/api/health", healthRoutes);
  app.use("/api/auth", requireDb, authRoutes);
  app.use("/api/projects", requireDb, projectRoutes);
  app.use("/api/projects", requireDb, tutorRoutes);
  app.use("/api/projects/:projectId/learning", requireDb, learningRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
