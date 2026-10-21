import { test, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod, server, base, mongoose;
const ORIGIN = "http://localhost:5173";

// Minimal cookie-jar client so each "browser" keeps its own session cookie.
function client() {
  let cookie = "";
  return async (method, path, body, { csrf = true, origin = ORIGIN } = {}) => {
    const headers = { "Content-Type": "application/json", Origin: origin };
    if (csrf) headers["X-Requested-With"] = "codemate";
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const pair = c.split(";")[0];
      cookie = pair.endsWith("=") ? "" : pair;
      res.rawSetCookie = c;
    }
    const text = await res.text();
    res.json = text ? JSON.parse(text) : null;
    return res;
  };
}

process.env.CLIENT_URL = ORIGIN;
process.env.SESSION_SECRET = "test-secret-test-secret";
process.env.AUTH_RATE_LIMIT = "1000";

let dbReady = false;
let skipReason = "";
try {
  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri("codemate_test");
  }
  process.env.MONGODB_URI = uri;
  mongoose = (await import("mongoose")).default;
  const { connectDb } = await import("../src/config/db.js");
  const db = await connectDb();
  dbReady = db.connected;
  if (!dbReady) skipReason = db.reason;
} catch (e) {
  skipReason = "no MongoDB available (set MONGODB_TEST_URI): " + String(e.message).split("\n")[0].slice(0, 120);
}

const { createApp } = await import("../src/app.js");
await new Promise((r) => {
  server = createApp().listen(0, r);
});
base = `http://localhost:${server.address().port}/api`;

after(async () => {
  server?.close();
  await mongoose?.disconnect();
  await mongod?.stop();
});

const dbTest = (name, fn) => test(name, { skip: dbReady ? false : skipReason }, fn);

const valid = { name: "Ada Lovelace", email: "Ada@Example.com", password: "Passw0rdOK", confirmPassword: "Passw0rdOK" };

dbTest("register validates input on the server", async () => {
  const c = client();
  const r1 = await c("POST", "/auth/register", { ...valid, password: "short", confirmPassword: "short" });
  assert.equal(r1.status, 400);
  assert.ok(r1.json.error.details.password);
  const r2 = await c("POST", "/auth/register", { ...valid, confirmPassword: "different1" });
  assert.equal(r2.status, 400);
  assert.ok(r2.json.error.details.confirmPassword);
  const r3 = await c("POST", "/auth/register", { ...valid, email: "not-an-email" });
  assert.equal(r3.status, 400);
  const r4 = await c("POST", "/auth/register", { ...valid, password: "onlyletters", confirmPassword: "onlyletters" });
  assert.equal(r4.status, 400);
});

dbTest("register creates a user, hashes the password, sets an HttpOnly cookie", async () => {
  const c = client();
  const res = await c("POST", "/auth/register", valid);
  assert.equal(res.status, 201);
  assert.equal(res.json.user.email, "ada@example.com"); // normalised
  assert.equal(res.json.user.passwordHash, undefined);
  assert.match(res.rawSetCookie, /HttpOnly/i);
  assert.match(res.rawSetCookie, /SameSite=Lax/i);

  const User = (await import("../src/models/User.js")).default;
  const doc = await User.findOne({ email: "ada@example.com" }).select("+passwordHash");
  assert.notEqual(doc.passwordHash, valid.password);
  assert.match(doc.passwordHash, /^\$2[aby]\$/);

  const me = await c("GET", "/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.json.user.name, "Ada Lovelace");
});

dbTest("duplicate email is rejected (case-insensitive)", async () => {
  const c = client();
  const res = await c("POST", "/auth/register", { ...valid, email: "ADA@example.com" });
  assert.equal(res.status, 409);
  assert.equal(res.json.error.code, "email_taken");
});

dbTest("login: wrong password and unknown email give the same generic error", async () => {
  const c = client();
  const bad = await c("POST", "/auth/login", { email: "ada@example.com", password: "WrongPass1" });
  const unknown = await c("POST", "/auth/login", { email: "nobody@example.com", password: "WrongPass1" });
  assert.equal(bad.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(bad.json.error.message, unknown.json.error.message);
});

dbTest("login, session persistence, logout", async () => {
  const c = client();
  assert.equal((await c("GET", "/auth/me")).status, 401);
  const login = await c("POST", "/auth/login", { email: "ada@example.com", password: valid.password });
  assert.equal(login.status, 200);
  assert.equal((await c("GET", "/auth/me")).status, 200);
  const out = await c("POST", "/auth/logout");
  assert.equal(out.status, 200);
  assert.equal((await c("GET", "/auth/me")).status, 401);
});

dbTest("a logged-out (stolen/old) cookie no longer works server-side", async () => {
  const c = client();
  await c("POST", "/auth/login", { email: "ada@example.com", password: valid.password });
  // capture cookie by re-issuing a request with raw header
  const res = await c("POST", "/auth/login", { email: "ada@example.com", password: valid.password });
  const token = res.rawSetCookie.split(";")[0];
  await c("POST", "/auth/logout");
  const replay = await fetch(base + "/auth/me", { headers: { Cookie: token } });
  assert.equal(replay.status, 401);
});

dbTest("session tokens are stored hashed, not in plaintext", async () => {
  const c = client();
  const res = await c("POST", "/auth/login", { email: "ada@example.com", password: valid.password });
  const token = res.rawSetCookie.split(";")[0].split("=")[1];
  const Session = (await import("../src/models/Session.js")).default;
  assert.equal(await Session.countDocuments({ tokenHash: token }), 0);
  assert.equal(await Session.countDocuments({}) > 0, true);
});

dbTest("CSRF: state-changing requests need the custom header and a matching origin", async () => {
  const c = client();
  const noHeader = await c("POST", "/auth/login", { email: "ada@example.com", password: valid.password }, { csrf: false });
  assert.equal(noHeader.status, 403);
  const badOrigin = await c("POST", "/auth/login", { email: "ada@example.com", password: valid.password }, { origin: "https://evil.example" });
  assert.equal(badOrigin.status, 403);
});

dbTest("profile update and password change (other sessions are revoked)", async () => {
  const a = client();
  const b = client();
  await a("POST", "/auth/login", { email: "ada@example.com", password: valid.password });
  await b("POST", "/auth/login", { email: "ada@example.com", password: valid.password });

  const prof = await a("PATCH", "/auth/profile", { name: "Ada L." });
  assert.equal(prof.json.user.name, "Ada L.");

  const wrong = await a("POST", "/auth/password", { currentPassword: "nope12345", newPassword: "NewPassw0rd", confirmPassword: "NewPassw0rd" });
  assert.equal(wrong.status, 400);

  const ok = await a("POST", "/auth/password", { currentPassword: valid.password, newPassword: "NewPassw0rd", confirmPassword: "NewPassw0rd" });
  assert.equal(ok.status, 200);
  assert.equal((await a("GET", "/auth/me")).status, 200); // this device stays signed in
  assert.equal((await b("GET", "/auth/me")).status, 401); // other device signed out

  const relog = await client()("POST", "/auth/login", { email: "ada@example.com", password: "NewPassw0rd" });
  assert.equal(relog.status, 200);
});

dbTest("two users have separate identities", async () => {
  const grace = client();
  await grace("POST", "/auth/register", { name: "Grace Hopper", email: "grace@example.com", password: "Cobol1959x", confirmPassword: "Cobol1959x" });
  const me = await grace("GET", "/auth/me");
  assert.equal(me.json.user.email, "grace@example.com");
});

test("login endpoint is rate limited (no DB needed)", async () => {
  // Fresh app instance with a tiny limit, same database.
  process.env.AUTH_RATE_LIMIT = "3";
  const { default: express } = await import("express");
  const { default: authRoutes } = await import("../src/modules/auth/auth.routes.js?limited");
  const { csrfGuard } = await import("../src/middleware/csrf.js");
  const { errorHandler } = await import("../src/middleware/errorHandler.js");
  const app = express();
  app.use(express.json());
  app.use(csrfGuard);
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  const s = await new Promise((r) => { const x = app.listen(0, () => r(x)); });
  const url = `http://localhost:${s.address().port}/api/auth/login`;
  const statuses = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "codemate" },
      body: JSON.stringify({ email: "ada@example.com", password: "WrongPass1" }),
    });
    statuses.push(r.status);
  }
  s.close();
  assert.ok(statuses.includes(429), `expected a 429 in ${statuses}`);
});
