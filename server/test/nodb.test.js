import { test, after } from "node:test";
import assert from "node:assert/strict";

// These run with no database at all and verify guards that sit in front of it.
process.env.CLIENT_URL = "http://localhost:5173";
process.env.MONGODB_URI = "";
const { createApp } = await import("../src/app.js");
const { default: express } = await import("express");
const { default: authRoutes } = await import("../src/modules/auth/auth.routes.js");
const { errorHandler } = await import("../src/middleware/errorHandler.js");

let server;
await new Promise((r) => (server = createApp().listen(0, r)));
const base = `http://localhost:${server.address().port}/api`;
after(() => server.close());

const post = (path, body, headers = {}) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173", "X-Requested-With": "codemate", ...headers },
    body: JSON.stringify(body),
  });

test("health stays up and reports the database as disconnected", async () => {
  const r = await fetch(base + "/health");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).database, "disconnected");
});

test("auth routes return a clear 503 when the database is down", async () => {
  const r = await post("/auth/login", { email: "a@b.co", password: "x" });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error.code, "db_unavailable");
});

test("CSRF guard rejects missing header and foreign origin before anything else", async () => {
  const noHeader = await post("/auth/login", {}, { "X-Requested-With": "" });
  assert.equal(noHeader.status, 403);
  const evil = await post("/auth/login", {}, { Origin: "https://evil.example" });
  assert.equal(evil.status, 403);
});

test("protected endpoint without a cookie is unauthenticated (401)", async () => {
  // Mount routes without requireDb: requireAuth fails on the missing cookie before any DB call.
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  const s = await new Promise((r) => { const x = app.listen(0, () => r(x)); });
  const res = await fetch(`http://localhost:${s.address().port}/api/auth/me`);
  s.close();
  // requireAuth looks up a session only when a cookie exists; with none it must return 401, not 500.
  assert.equal(res.status, 401);
});

test("server-side validation rejects bad registrations with field errors (no DB needed)", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  const s = await new Promise((r) => { const x = app.listen(0, () => r(x)); });
  const url = `http://localhost:${s.address().port}/api/auth/register`;
  const send = (b) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const base = { name: "Ada Lovelace", email: "ada@example.com", password: "Passw0rdOK", confirmPassword: "Passw0rdOK" };

  const short = await send({ ...base, password: "short", confirmPassword: "short" });
  const mismatch = await send({ ...base, confirmPassword: "Different1" });
  const badEmail = await send({ ...base, email: "nope" });
  const noDigit = await send({ ...base, password: "onlyletters", confirmPassword: "onlyletters" });
  const noName = await send({ ...base, name: "A" });
  s.close();

  for (const r of [short, mismatch, badEmail, noDigit, noName]) assert.equal(r.status, 400);
  assert.ok(short.body.error.details.password);
  assert.ok(mismatch.body.error.details.confirmPassword);
  assert.ok(badEmail.body.error.details.email);
  assert.ok(noDigit.body.error.details.password);
  assert.ok(noName.body.error.details.name);
});
