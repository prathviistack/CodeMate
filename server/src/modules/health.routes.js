import { Router } from "express";
import { dbState } from "../config/db.js";
import { env } from "../config/env.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "codemate-server",
    database: dbState(),
    ai: { configured: Boolean(env.ai.apiKey && env.ai.model), provider: env.ai.provider },
    time: new Date().toISOString(),
  });
});

export default router;
