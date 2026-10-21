import { test, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, makeClient, installGithubMock } from "./helpers.js";

const app = await startTestApp();
after(() => app.stop());
const dbTest = (name, fn) => test(name, { skip: app.dbReady ? false : app.skipReason }, fn);
const newClient = makeClient(app.base, app.realFetch);
if (app.dbReady) installGithubMock(app.realFetch);

const signup = async (name, email) => {
  const c = newClient();
  const r = await c("POST", "/auth/register", { name, email, password: "Passw0rd123", confirmPassword: "Passw0rd123" });
  assert.equal(r.status, 201);
  return c;
};
const imp = (c, url, name) => c("POST", "/projects/import", { url, name });

let alice, bob;
let p1, p2;

dbTest("unauthenticated requests cannot touch projects", async () => {
  const anon = newClient();
  assert.equal((await anon("GET", "/projects")).status, 401);
  assert.equal((await imp(anon, "https://github.com/a/b")).status, 401);
});

dbTest("first import creates 'Project 1' with real repo details and snapshot sha", async () => {
  alice = await signup("Alice", "alice@example.com");
  const r = await imp(alice, "https://github.com/octo/alpha");
  assert.equal(r.status, 201);
  p1 = r.json.project;
  assert.equal(p1.number, 1);
  assert.equal(p1.name, "Project 1");
  assert.equal(p1.repoOwner, "octo");
  assert.equal(p1.repoName, "alpha");
  assert.equal(p1.defaultBranch, "main");
  assert.equal(p1.snapshotSha, "sha_alpha");
  assert.equal(p1.analysisStatus, "pending");
  assert.deepEqual(p1.languages, []); // nothing "detected" yet
});

dbTest("second import creates Project 2 and does not overwrite Project 1", async () => {
  const r = await imp(alice, "https://github.com/octo/beta", "My Beta");
  assert.equal(r.status, 201);
  p2 = r.json.project;
  assert.equal(p2.number, 2);
  assert.equal(p2.name, "My Beta"); // custom name respected
  const list = await alice("GET", "/projects?sort=number");
  assert.equal(list.json.total, 2);
  assert.deepEqual(list.json.projects.map((p) => p.repoName), ["alpha", "beta"]);
  assert.equal(list.json.projects[0].name, "Project 1");
});

dbTest("importing the same repository again is rejected with a pointer to the existing project", async () => {
  const dup = await imp(alice, "https://github.com/OCTO/Alpha.git");
  assert.equal(dup.status, 409);
  assert.equal(dup.json.error.code, "already_imported");
  assert.equal(dup.json.error.details.projectId, p1.id);
  assert.equal((await alice("GET", "/projects")).json.total, 2);
});

dbTest("import errors: bad URL, missing repo, private repo", async () => {
  assert.equal((await imp(alice, "https://gitlab.com/a/b")).status, 400);
  assert.equal((await imp(alice, "")).status, 400);
  const missing = await imp(alice, "https://github.com/octo/missing");
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, "repo_not_found");
  const priv = await imp(alice, "https://github.com/octo/secret");
  assert.equal(priv.status, 400);
  assert.equal(priv.json.error.code, "repo_private");
  assert.equal((await alice("GET", "/projects")).json.total, 2); // failures create nothing
});

dbTest("renaming changes only the display name, never the repository fields", async () => {
  const r = await alice("PATCH", `/projects/${p1.id}`, { name: "JalRakshak" });
  assert.equal(r.status, 200);
  assert.equal(r.json.project.name, "JalRakshak");
  assert.equal(r.json.project.repoName, "alpha");
  assert.equal(r.json.project.githubUrl, "https://github.com/octo/alpha");
  assert.equal(r.json.project.number, 1);
  assert.equal((await alice("PATCH", `/projects/${p1.id}`, { name: "   " })).status, 400);
  assert.equal((await alice("PATCH", `/projects/${p1.id}`, { name: "x".repeat(81) })).status, 400);
  // Extra fields (e.g. trying to change the repo) are rejected, not silently applied.
  assert.equal((await alice("PATCH", `/projects/${p1.id}`, { name: "ok", repoName: "hacked" })).status, 400);
});

dbTest("project numbers are never reused after a delete", async () => {
  assert.equal((await alice("DELETE", `/projects/${p2.id}`, {})).status, 400); // needs explicit confirm
  assert.equal((await alice("DELETE", `/projects/${p2.id}`, { confirm: true })).status, 200);
  const r = await imp(alice, "https://github.com/octo/gamma");
  assert.equal(r.json.project.number, 3); // not 2
  assert.equal(r.json.project.name, "Project 3");
  assert.equal((await alice("GET", `/projects/${p2.id}`)).status, 404);
});

dbTest("archive hides from the default list, restore brings it back", async () => {
  assert.equal((await alice("POST", `/projects/${p1.id}/archive`)).json.project.archived, true);
  assert.equal((await alice("GET", "/projects")).json.projects.some((p) => p.id === p1.id), false);
  assert.equal((await alice("GET", "/projects?archived=true")).json.projects.length, 1);
  assert.equal((await alice("GET", "/projects?archived=all")).json.total, 2);
  assert.equal((await alice("POST", `/projects/${p1.id}/restore`)).json.project.archived, false);
  assert.equal((await alice("GET", "/projects")).json.projects.some((p) => p.id === p1.id), true);
});

dbTest("search, sort, pagination and filters", async () => {
  assert.equal((await alice("GET", "/projects?q=jalrak")).json.total, 1); // by custom name
  assert.equal((await alice("GET", "/projects?q=gamma")).json.total, 1); // by repo name
  assert.equal((await alice("GET", "/projects?q=octo")).json.total, 2); // by owner
  assert.equal((await alice("GET", "/projects?q=3")).json.projects[0].repoName, "gamma"); // by number
  assert.equal((await alice("GET", "/projects?q=.*")).json.total, 0); // regex chars are escaped
  const byName = await alice("GET", "/projects?sort=name");
  assert.deepEqual(byName.json.projects.map((p) => p.name), ["JalRakshak", "Project 3"]);
  const paged = await alice("GET", "/projects?limit=1&page=2&sort=number");
  assert.equal(paged.json.projects.length, 1);
  assert.equal(paged.json.pages, 2);
  assert.equal((await alice("GET", "/projects?analysis=ready")).json.total, 0);
  assert.equal((await alice("GET", "/projects?sort=bogus")).status, 400);
});

dbTest("stats reflect real records", async () => {
  const { stats } = (await alice("GET", "/projects/stats")).json;
  assert.equal(stats.total, 2);
  assert.equal(stats.active, 2);
  assert.equal(stats.analyzing, 2); // both still "pending"
  assert.equal(stats.analyzed, 0);
});

dbTest("another user cannot see, modify, archive or delete someone else's project", async () => {
  bob = await signup("Bob", "bob@example.com");
  assert.equal((await bob("GET", "/projects")).json.total, 0);
  assert.equal((await bob("GET", `/projects/${p1.id}`)).status, 404);
  assert.equal((await bob("PATCH", `/projects/${p1.id}`, { name: "pwned" })).status, 404);
  assert.equal((await bob("POST", `/projects/${p1.id}/archive`)).status, 404);
  assert.equal((await bob("GET", `/projects/${p1.id}/deletion-preview`)).status, 404);
  assert.equal((await bob("DELETE", `/projects/${p1.id}`, { confirm: true })).status, 404);
  // Still intact for Alice
  const mine = await alice("GET", `/projects/${p1.id}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.json.project.name, "JalRakshak");
});

dbTest("project numbering and duplicate detection are per user", async () => {
  const r = await imp(bob, "https://github.com/octo/alpha"); // same repo Alice has
  assert.equal(r.status, 201);
  assert.equal(r.json.project.number, 1); // Bob's own counter
  assert.notEqual(r.json.project.id, p1.id);
});

dbTest("malformed ids are a 404, not a server error", async () => {
  assert.equal((await alice("GET", "/projects/not-an-id")).status, 404);
  assert.equal((await alice("GET", "/projects/000000000000000000000000")).status, 404);
});

dbTest("opening a project records last-accessed time", async () => {
  const before = (await alice("GET", "/projects?sort=number")).json.projects[0].lastAccessedAt;
  await new Promise((r) => setTimeout(r, 20));
  await alice("GET", `/projects/${p1.id}`);
  const after = (await alice("GET", "/projects?sort=number")).json.projects[0].lastAccessedAt;
  assert.ok(new Date(after) > new Date(before));
});

dbTest("deletion preview works for an owned project", async () => {
  const r = await alice("GET", `/projects/${p1.id}/deletion-preview`);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.items));
});
