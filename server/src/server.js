import { env, validateEnv } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { createApp } from "./app.js";
import { recoverInterruptedIngestions } from "./jobs/ingestion.js";

const warnings = validateEnv();
warnings.forEach((w) => console.warn(`[config] ${w}`));

const db = await connectDb();
if (db.connected) {
  console.log("[db] MongoDB connected");
  const n = await recoverInterruptedIngestions();
  if (n) console.warn(`[ingestion] marked ${n} interrupted import(s) as failed so they can be retried`);
} else console.warn(`[db] Not connected: ${db.reason}`);

const app = createApp();
app.listen(env.port, () => console.log(`[server] CodeMate API listening on http://localhost:${env.port}`));
