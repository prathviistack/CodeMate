import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.set("strictQuery", true);

export async function connectDb() {
  if (!env.mongoUri) return { connected: false, reason: "MONGODB_URI not set" };
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
    return { connected: true };
  } catch (err) {
    return { connected: false, reason: err.message };
  }
}

export function dbState() {
  return ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] || "unknown";
}
