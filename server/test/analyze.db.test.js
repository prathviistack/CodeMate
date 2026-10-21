import { test, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, makeClient, installGithubMock } from "./helpers.js";

const app = await startTestApp();
after(() => app.stop());
const dbTest = (name, fn) => test(name, { skip: app.dbReady ? false : app.skipReason }, fn);
const newClient = makeClient(app.base, app.realFetch);
const gh = app.dbReady ? installGithubMock(app.realFetch) : null;

const signup = async (name, email) => {
  const c = newClient();
  const r = await c("POST", "/auth/register", { name, email, password: "Passw0rd123", confirmPassword: "Passw0rd123" });
  assert.equal(r.status, 201);
  return c;
};
const imp = (c, repo) => c("POST", "/projects/import", { url: `https://github.com/octo/${repo}` });

async function waitForIngestion(c, id, wanted = ["done", "failed"], ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await c("GET", `/projects/${id}/ingestion`);
    if (wanted.includes(r.json.ingestionStatus)) return r.json;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("ingestion did not finish in time");
}

let alice;

dbTest("analysis runs after successful ingestion", async () => {
  alice = await signup("Alice", "alice@example.com");
  const r = await imp(alice, "good");
  const projectId = r.json.project.id;

  // Wait for ingestion to complete
  const ing = await waitForIngestion(alice, projectId);
  assert.equal(ing.ingestionStatus, "done");

  // Check that analysis started
  const p1 = (await alice("GET", `/projects/${projectId}`)).json;
  // Analysis may be "running" or "ready" depending on timing
  assert.ok(["running", "ready", "failed"].includes(p1.analysisStatus));
});

dbTest("analysis detects JavaScript from package.json", async () => {
  const alice = await signup("Alice2", "alice2@example.com");
  const r = await imp(alice, "good");
  const projectId = r.json.project.id;

  // Wait for ingestion and analysis
  await waitForIngestion(alice, projectId);
  await new Promise((resolve) => setTimeout(resolve, 500)); // Give analysis time to finish

  const p = (await alice("GET", `/projects/${projectId}`)).json;
  assert.equal(p.analysisStatus, "ready");
  assert.ok(p.languages.includes("JavaScript"));
  assert.ok(p.frameworks.includes("Express")); // good repo has express in package.json
});

dbTest("analysis generates summary from detected technologies", async () => {
  const alice = await signup("Alice3", "alice3@example.com");
  const r = await imp(alice, "good");
  const projectId = r.json.project.id;

  await waitForIngestion(alice, projectId);
  await new Promise((resolve) => setTimeout(resolve, 500));

  const p = (await alice("GET", `/projects/${projectId}`)).json;
  assert.ok(p.summary.length > 0);
  // Summary should mention languages or frameworks
  assert.ok(p.summary.toLowerCase().includes("javascript") || p.summary.toLowerCase().includes("express"));
});

dbTest("projects with no manifests still complete analysis", async () => {
  const alice = await signup("Alice4", "alice4@example.com");
  const r = await imp(alice, "second");
  const projectId = r.json.project.id;

  await waitForIngestion(alice, projectId);
  await new Promise((resolve) => setTimeout(resolve, 500));

  const p = (await alice("GET", `/projects/${projectId}`)).json;
  // Analysis should complete even if no manifests found
  assert.ok(["ready", "failed"].includes(p.analysisStatus));
});

dbTest("analysis is skipped if ingestion fails", async () => {
  const alice = await signup("Alice5", "alice5@example.com");
  const r = await imp(alice, "flaky"); // Will fail after import

  const projectId = r.json.project.id;
  const failed = await waitForIngestion(alice, projectId);
  assert.equal(failed.ingestionStatus, "failed");

  // Check that analysis was not run
  const p = (await alice("GET", `/projects/${projectId}`)).json;
  assert.equal(p.analysisStatus, "pending"); // Should remain pending, not run
});

dbTest("analysis results are persisted to project", async () => {
  const alice = await signup("Alice6", "alice6@example.com");
  const r = await imp(alice, "good");
  const projectId = r.json.project.id;

  await waitForIngestion(alice, projectId);
  await new Promise((resolve) => setTimeout(resolve, 500));

  const p1 = (await alice("GET", `/projects/${projectId}`)).json;
  // Fetch again to verify persistence
  const p2 = (await alice("GET", `/projects/${projectId}`)).json;

  assert.deepEqual(p1.languages, p2.languages);
  assert.deepEqual(p1.frameworks, p2.frameworks);
  assert.equal(p1.summary, p2.summary);
});
