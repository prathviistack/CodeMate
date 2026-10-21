import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd,
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  mongoUri: process.env.MONGODB_URI || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  ai: {
    provider: process.env.AI_PROVIDER || "gemini",
    apiKey: process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "",
    embeddingModel: process.env.EMBEDDING_MODEL || "",
  },
  githubToken: process.env.GITHUB_TOKEN || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  // Repository ingestion limits (protect memory, database storage and GitHub).
  ingestion: {
    maxArchiveBytes: (Number(process.env.INGEST_MAX_ARCHIVE_MB) || 100) * 1024 * 1024,
    maxUncompressedBytes: (Number(process.env.INGEST_MAX_UNCOMPRESSED_MB) || 600) * 1024 * 1024,
    maxFileBytes: (Number(process.env.INGEST_MAX_FILE_KB) || 256) * 1024,
    maxNotebookBytes: 5 * 1024 * 1024,
    maxFiles: Number(process.env.INGEST_MAX_FILES) || 3000,
    maxTotalContentBytes: (Number(process.env.INGEST_MAX_CONTENT_MB) || 15) * 1024 * 1024,
    maxEntries: 100000,
    timeoutMs: (Number(process.env.INGEST_TIMEOUT_SEC) || 120) * 1000,
  },
  // "lax" works when client and API share a site (or localhost). Use "none" for cross-site deployments.
  cookieSameSite: ["lax", "strict", "none"].includes(process.env.COOKIE_SAMESITE) ? process.env.COOKIE_SAMESITE : "lax",
};

export function validateEnv() {
  const problems = [];
  if (!env.mongoUri) problems.push("MONGODB_URI is not set (database features disabled).");
  if (!env.sessionSecret || env.sessionSecret.startsWith("change-me")) {
    if (isProd) throw new Error("SESSION_SECRET must be set to a strong value in production.");
    problems.push("SESSION_SECRET is not set to a strong value (OK for local dev only).");
  }
  if (!env.ai.apiKey || !env.ai.model) {
    problems.push("AI_API_KEY / AI_MODEL not set: AI features will report a configuration error.");
  }
  return problems;
}
