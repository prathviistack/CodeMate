import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { parseGithubUrl } from "../src/github/githubUrl.js";
import { fetchRepoSnapshot } from "../src/github/githubClient.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const meta = (over = {}) => ({
  name: "Repo",
  owner: { login: "Owner" },
  html_url: "https://github.com/Owner/Repo",
  default_branch: "main",
  description: "A repo",
  language: "JavaScript",
  stargazers_count: 7,
  size: 120,
  private: false,
  ...over,
});

test("parseGithubUrl accepts common URL shapes", () => {
  const ok = [
    "https://github.com/octocat/Hello-World",
    "https://github.com/octocat/Hello-World/",
    "https://github.com/octocat/Hello-World.git",
    "http://github.com/octocat/Hello-World",
    "github.com/octocat/Hello-World",
    "https://www.github.com/octocat/Hello-World",
    "  https://github.com/octocat/Hello-World  ",
    "https://github.com/octocat/Hello-World/tree/main/src",
  ];
  for (const u of ok) {
    const r = parseGithubUrl(u);
    assert.equal(r.owner, "octocat", u);
    assert.equal(r.repo, "Hello-World", u);
    assert.equal(r.url, "https://github.com/octocat/Hello-World");
    assert.equal(r.key, "octocat/hello-world");
  }
});

test("parseGithubUrl keeps dots in repo names but strips .git", () => {
  assert.equal(parseGithubUrl("https://github.com/vercel/next.js").repo, "next.js");
  assert.equal(parseGithubUrl("https://github.com/a/b.c.git").repo, "b.c");
});

test("parseGithubUrl rejects non-GitHub and malformed input", () => {
  const bad = [
    "",
    "   ",
    "not a url",
    "https://gitlab.com/a/b",
    "https://github.com.evil.com/a/b",
    "https://evil.com/github.com/a/b",
    "https://github.com/onlyowner",
    "https://github.com/",
    "https://github.com/a/b/settings/secrets",
    "https://user:pass@github.com/a/b",
    "ftp://github.com/a/b",
    "https://github.com/-bad-/repo",
    "https://github.com/a/..",
    "javascript:alert(1)",
    "https://github.com/" + "a".repeat(50) + "/repo",
    "x".repeat(400),
    null,
    undefined,
    42,
  ];
  for (const u of bad) {
    assert.throws(() => parseGithubUrl(u), (e) => e.status === 400 && e.code === "invalid_github_url", `should reject: ${String(u).slice(0, 40)}`);
  }
});

test("fetchRepoSnapshot returns repo details and the head commit", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return String(url).endsWith("/commits/main") ? json({ sha: "abc123" }) : json(meta());
  };
  const snap = await fetchRepoSnapshot({ owner: "owner", repo: "repo" });
  assert.deepEqual(snap, {
    repoOwner: "Owner",
    repoName: "Repo",
    githubUrl: "https://github.com/Owner/Repo",
    defaultBranch: "main",
    snapshotSha: "abc123",
    repoDescription: "A repo",
    githubLanguage: "JavaScript",
    stars: 7,
    repoSizeKb: 120,
  });
  assert.equal(calls.length, 2);
});

test("fetchRepoSnapshot: 404 maps to 'not found or private'", async () => {
  globalThis.fetch = async () => json({ message: "Not Found" }, 404);
  await assert.rejects(fetchRepoSnapshot({ owner: "a", repo: "b" }), (e) => e.status === 404 && e.code === "repo_not_found");
});

test("fetchRepoSnapshot: rate limit is reported clearly", async () => {
  globalThis.fetch = async () => json({ message: "rate limited" }, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000" });
  await assert.rejects(fetchRepoSnapshot({ owner: "a", repo: "b" }), (e) => e.status === 429 && e.code === "github_rate_limited" && /GITHUB_TOKEN/.test(e.message));
});

test("fetchRepoSnapshot: private repositories are refused", async () => {
  globalThis.fetch = async () => json(meta({ private: true }));
  await assert.rejects(fetchRepoSnapshot({ owner: "a", repo: "b" }), (e) => e.code === "repo_private");
});

test("fetchRepoSnapshot: empty repository is reported", async () => {
  globalThis.fetch = async (url) => (String(url).includes("/commits/") ? json({ message: "Git Repository is empty." }, 409) : json(meta()));
  await assert.rejects(fetchRepoSnapshot({ owner: "a", repo: "b" }), (e) => e.status === 422 && e.code === "repo_empty");
});

test("fetchRepoSnapshot: network failure and timeout are mapped, not leaked", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  await assert.rejects(fetchRepoSnapshot({ owner: "a", repo: "b" }), (e) => e.status === 502 && e.code === "github_unreachable");

  globalThis.fetch = async () => {
    const err = new Error("timeout");
    err.name = "TimeoutError";
    throw err;
  };
  await assert.rejects(fetchRepoSnapshot({ owner: "a", repo: "b" }), (e) => e.status === 504 && e.code === "github_timeout");
});

test("fetchRepoSnapshot: unexpected GitHub errors become 502", async () => {
  globalThis.fetch = async () => json({}, 500);
  await assert.rejects(fetchRepoSnapshot({ owner: "a", repo: "b" }), (e) => e.status === 502 && e.code === "github_error");
});
