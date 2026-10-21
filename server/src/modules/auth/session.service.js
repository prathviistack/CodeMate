import crypto from "crypto";
import Session from "../../models/Session.js";
import { env } from "../../config/env.js";

export const COOKIE_NAME = "codemate_sid";
const SESSION_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

export function cookieOptions() {
  // Cross-site deployments (client and API on different sites) need SameSite=None + Secure.
  const sameSite = env.cookieSameSite;
  return {
    httpOnly: true,
    secure: env.isProd || sameSite === "none",
    sameSite,
    path: "/",
    maxAge: SESSION_DAYS * DAY_MS,
  };
}

export async function createSession(res, userId, userAgent) {
  const token = crypto.randomBytes(32).toString("base64url");
  await Session.create({
    userId,
    tokenHash: hash(token),
    userAgent: (userAgent || "").slice(0, 300),
    expiresAt: new Date(Date.now() + SESSION_DAYS * DAY_MS),
  });
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

export async function findSession(token) {
  if (!token || typeof token !== "string") return null;
  const session = await Session.findOne({ tokenHash: hash(token) });
  if (!session || session.expiresAt < new Date()) return null;
  // Sliding expiry: extend when less than half the lifetime is left.
  if (session.expiresAt.getTime() - Date.now() < (SESSION_DAYS * DAY_MS) / 2) {
    session.expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await session.save();
  }
  return session;
}

export async function destroySession(token) {
  if (token) await Session.deleteOne({ tokenHash: hash(token) });
}

export async function destroyOtherSessions(userId, keepToken) {
  await Session.deleteMany({ userId, tokenHash: { $ne: hash(keepToken || "") } });
}

export function clearSessionCookie(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
}
