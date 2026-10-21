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

let alice, bob, p;

dbTest("importing starts a background ingestion that stores filtered, redacted files", async () => {
  alice = await signup("Alice", "alice@example.com");
  const r = await imp(alice, "good");
  assert.equal(r.status, 201);
  p = r.json.project;
  assert.ok(["running", "done"].includes(p.ingestionStatus));

  const ing = await waitForIngestion(alice, p.id);
  assert.equal(ing.ingestionStatus, "done");
  assert.equal(ing.ingestionStats.storedFiles, 5); // README, package.json, src/index.js, src/config.js, tests/app.test.js
  assert.equal(ing.ingestionStats.redactedFiles, 1);
  assert.equal(ing.ingestionStats.skipped.sensitive_file, 1);
  assert.equal(ing.ingestionStats.skipped.ignored_dir, 1);
  assert.equal(ing.ingestionStats.skipped.binary, 1);
  assert.equal(ing.ingestionStats.skipped.generated, 1);

  const files = (await alice("GET", `/projects/${p.id}/files`)).json;
  assert.deepEqual(files.files.map((f) => f.path), ["README.md", "package.json", "src/config.js", "src/index.js", "tests/app.test.js"]);
  assert.equal(files.snapshotSha, "sha_good");
  assert.ok(files.files.every((f) => f.content === undefined)); // list never ships file bodies
});

dbTest("file content is served redacted and tied to the snapshot", async () => {
  const r = await alice("GET", `/projects/${p.id}/files/content?path=${encodeURIComponent("src/config.js")}`);
  assert.equal(r.status, 200);
  assert.ok(!r.json.file.content.includes("AKIAABCDEFGHIJKLMNOP"));
  assert.ok(r.json.file.content.includes("[REDACTED]"));
  assert.equal(r.json.file.redactions, 1);
  assert.equal(r.json.file.language, "JavaScript");
  assert.equal(r.json.snapshotSha, "sha_good");
});

dbTest("sensitive files were never stored and bad paths are rejected", async () => {
  const q = (path) => alice("GET", `/projects/${p.id}/files/content?path=${encodeURIComponent(path)}`);
  assert.equal((await q(".env")).status, 404);
  assert.equal((await q("node_modules/x/index.js")).status, 404);
  assert.equal((await q("../../etc/passwd")).status, 400);
  assert.equal((await q("/etc/passwd")).status, 400);
  assert.equal((await alice("GET", `/projects/${p.id}/files/content`)).status, 400); // path required
});

dbTest("another user cannot list or read someone else's files, or retry their import", async () => {
  bob = await signup("Bob", "bob@example.com");
  assert.equal((await bob("GET", `/projects/${p.id}/files`)).status, 404);
  assert.equal((await bob("GET", `/projects/${p.id}/files/content?path=README.md`)).status, 404);
  assert.equal((await bob("GET", `/projects/${p.id}/ingestion`)).status, 404);
  assert.equal((await bob("POST", `/projects/${p.id}/ingestion/retry`)).status, 404);
});

dbTest("two projects keep separate files", async () => {
  const r2 = await imp(alice, "second");
  const id2 = r2.json.project.id;
  await waitForIngestion(alice, id2);
  const a = (await alice("GET", `/projects/${p.id}/files`)).json;
  const b = (await alice("GET", `/projects/${id2}/files`)).json;
  assert.equal(a.files.length, 5);
  assert.equal(b.files.length, 5);
  assert.equal(b.snapshotSha, "sha_second");
});

dbTest("a failed import is reported, creates no files, and can be retried without a duplicate project", async () => {
  const r = await imp(alice, "flaky");
  const id = r.json.project.id;
  const failed = await waitForIngestion(alice, id);
  assert.equal(failed.ingestionStatus, "failed");
  assert.match(failed.ingestionError, /snapshot|downloaded|private/i);
  assert.equal((await alice("GET", `/projects/${id}/files`)).json.files.length, 0);

  const before = (await alice("GET", "/projects")).json.total;
  const retry = await alice("POST", `/projects/${id}/ingestion/retry`);
  assert.equal(retry.status, 202);
  const done = await waitForIngestion(alice, id);
  assert.equal(done.ingestionStatus, "done");
  assert.equal((await alice("GET", `/projects/${id}/files`)).json.files.length, 5);
  assert.equal((await alice("GET", "/projects")).json.total, before); // no duplicate project
});

dbTest("retry is refused when files are already imported or an import is running", async () => {
  assert.equal((await alice("POST", `/projects/${p.id}/ingestion/retry`)).status, 409); // done

  const r = await imp(alice, "slow");
  const id = r.json.project.id;
  const again = await alice("POST", `/projects/${id}/ingestion/retry`);
  assert.equal(again.status, 409); // still running
  assert.equal(again.json.error.code, "ingestion_running");
  await waitForIngestion(alice, id);
});

dbTest("a snapshot that no longer exists fails cleanly with an explanation", async () => {
  const r = await imp(alice, "gone");
  const ing = await waitForIngestion(alice, r.json.project.id);
  assert.equal(ing.ingestionStatus, "failed");
  assert.ok(ing.ingestionError.length > 10);
});

dbTest("deleting a project during an import cancels it and leaves no files behind", async () => {
  const RepoFile = (await import("../src/models/RepoFile.js")).default;
  const r = await imp(alice, "slow");
  const id = r.json.project.id;
  const del = await alice("DELETE", `/projects/${id}`, { confirm: true });
  assert.equal(del.status, 200);
  await new Promise((res) => setTimeout(res, 700)); // longer than the mock's download delay
  assert.equal(await RepoFile.countDocuments({ projectId: id }), 0);
  assert.equal((await alice("GET", `/projects/${id}`)).status, 404);
});

dbTest("deleting a project removes its files and the delete preview lists them", async () => {
  const RepoFile = (await import("../src/models/RepoFile.js")).default;
  const preview = (await alice("GET", `/projects/${p.id}/deletion-preview`)).json.items;
  assert.deepEqual(preview, [{ label: "stored source files", count: 5 }]);
  assert.equal(await RepoFile.countDocuments({ projectId: p.id }), 5);
  assert.equal((await alice("DELETE", `/projects/${p.id}`, { confirm: true })).status, 200);
  assert.equal(await RepoFile.countDocuments({ projectId: p.id }), 0);
});

dbTest("an import interrupted by a server restart is marked failed so it can be retried", async () => {
  const Project = (await import("../src/models/Project.js")).default;
  const { recoverInterruptedIngestions } = await import("../src/jobs/ingestion.js");
  const r = await imp(alice, "good2");
  const id = r.json.project.id;
  await waitForIngestion(alice, id);
  await Project.updateOne({ _id: id }, { $set: { ingestionStatus: "running", ingestionStage: "downloading" } }); // simulate a crash mid-run
  assert.ok((await recoverInterruptedIngestions()) >= 1);
  const ing = (await alice("GET", `/projects/${id}/ingestion`)).json;
  assert.equal(ing.ingestionStatus, "failed");
  assert.match(ing.ingestionError, /restart/i);
});

dbTest("the mock was used (no real network calls were made)", () => {
  assert.ok(gh.codeloadCalls > 0);
});
