import { MongoMemoryServer } from "mongodb-memory-server";
import zlib from "zlib";
import tar from "tar-stream";

export const ORIGIN = "http://localhost:5173";

// Boots the real app against a real MongoDB (MONGODB_TEST_URI, else an in-memory one).
// If no database can be reached, dbReady is false and callers skip DB-backed tests.
export async function startTestApp() {
  process.env.CLIENT_URL = ORIGIN;
  process.env.SESSION_SECRET = "test-secret-test-secret";
  process.env.AUTH_RATE_LIMIT = "1000";
  process.env.IMPORT_RATE_LIMIT = "1000";

  let mongod, mongoose;
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
  const server = await new Promise((r) => {
    const s = createApp().listen(0, () => r(s));
  });
  const base = `http://localhost:${server.address().port}/api`;
  const realFetch = globalThis.fetch;

  return {
    dbReady,
    skipReason,
    base,
    realFetch,
    mongoose,
    async stop() {
      globalThis.fetch = realFetch;
      server.close();
      await mongoose?.disconnect();
      await mongod?.stop();
    },
  };
}

// Each client is its own "browser" with its own cookie jar.
export function makeClient(base, realFetch) {
  return () => {
    let cookie = "";
    return async (method, path, body, { csrf = true, origin = ORIGIN } = {}) => {
      const headers = { "Content-Type": "application/json", Origin: origin };
      if (csrf) headers["X-Requested-With"] = "codemate";
      if (cookie) headers.Cookie = cookie;
      const res = await realFetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      for (const c of res.headers.getSetCookie?.() || []) {
        const pair = c.split(";")[0];
        cookie = pair.endsWith("=") ? "" : pair;
      }
      const text = await res.text();
      res.json = text ? JSON.parse(text) : null;
      return res;
    };
  };
}

// Builds a GitHub-style .tar.gz snapshot in memory: one top-level folder containing the files.
export async function makeTarGz(root, files, extraEntries = []) {
  const pack = tar.pack();
  pack.entry({ name: `${root}/`, type: "directory" });
  for (const [path, content] of Object.entries(files)) pack.entry({ name: `${root}/${path}` }, content);
  for (const header of extraEntries) pack.entry(header, header.body ?? "");
  pack.finalize();
  const chunks = [];
  for await (const c of pack.pipe(zlib.createGzip())) chunks.push(c);
  return Buffer.concat(chunks);
}

export const FIXTURE_FILES = {
  "README.md": "# Hello\n",
  "package.json": '{"name":"x","dependencies":{"express":"^4"}}\n',
  "src/index.js": 'const express = require("express");\nconsole.log("hi");\n',
  "src/config.js": 'const apiKey = "AKIAABCDEFGHIJKLMNOP";\nmodule.exports = { apiKey };\n',
  ".env": "SECRET=abc",
  "node_modules/x/index.js": "x",
  "logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]),
  "package-lock.json": "{}",
  "tests/app.test.js": 'test("x",()=>{})\n',
};

// Fake GitHub. api.github.com and codeload.github.com are answered locally; everything else
// passes through. Special repo names: missing, secret (private), flaky (first download fails),
// slow (download takes ~400ms), gone (download always 404).
export function installGithubMock(realFetch) {
  const state = { codeloadCalls: 0, flakyFailed: false };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  globalThis.fetch = async (url, opts) => {
    const u = String(url);

    if (u.startsWith("https://codeload.github.com/")) {
      state.codeloadCalls++;
      const m = u.match(/^https:\/\/codeload\.github\.com\/([^/]+)\/([^/]+)\/tar\.gz\/(.+)$/);
      const [, owner, repo, sha] = m;
      if (repo === "gone") return new Response("Not Found", { status: 404 });
      if (repo === "flaky" && !state.flakyFailed) {
        state.flakyFailed = true;
        return new Response("Not Found", { status: 404 });
      }
      if (repo === "slow") await new Promise((r) => setTimeout(r, 400));
      const body = await makeTarGz(`${owner}-${repo}-${sha.slice(0, 7)}`, FIXTURE_FILES);
      return new Response(body, { status: 200, headers: { "Content-Type": "application/gzip" } });
    }

    if (!u.startsWith("https://api.github.com")) return realFetch(url, opts);
    const m = u.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)(\/commits\/.+)?$/);
    if (!m) return json({}, 404);
    const [, owner, repo, commits] = m;
    if (repo === "missing") return json({ message: "Not Found" }, 404);
    if (repo === "secret") return json({ name: repo, owner: { login: owner }, private: true, default_branch: "main" });
    if (commits) return json({ sha: "sha_" + repo });
    return json({
      name: repo,
      owner: { login: owner },
      html_url: `https://github.com/${owner}/${repo}`,
      default_branch: "main",
      description: `Fake ${repo}`,
      language: "Python",
      stargazers_count: 3,
      size: 50,
      private: false,
    });
  };
  return state;
}
