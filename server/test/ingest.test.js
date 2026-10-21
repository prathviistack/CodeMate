import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { Readable } from "stream";
import zlib from "zlib";
import tar from "tar-stream";
import { classifyPath, pathPriority } from "../src/code-analysis/fileFilter.js";
import { detectLanguage, fileKind } from "../src/code-analysis/languages.js";
import { scanAndRedact } from "../src/code-analysis/secrets.js";
import { notebookToText } from "../src/code-analysis/notebook.js";
import { extractRepoFiles, safeRelativePath } from "../src/github/archiveExtractor.js";
import { openSnapshotStream } from "../src/github/archiveDownload.js";
import { makeTarGz } from "./helpers.js";

const LIMITS = { maxFileBytes: 1000, maxNotebookBytes: 5000 };

// ---------- file filter ----------
test("classifyPath skips dependency, build and cache folders at any depth", () => {
  for (const p of ["node_modules/a/b.js", "web/node_modules/x.js", "dist/app.js", "build/out.js", "src/__pycache__/m.py", ".git/config", "vendor/lib.php", "app/.venv/lib/x.py", "Pods/Foo.m"]) {
    assert.equal(classifyPath(p, 10, LIMITS), "ignored_dir", p);
  }
  assert.equal(classifyPath("scripts/build.js", 10, LIMITS), null);
  assert.equal(classifyPath("src/distance.js", 10, LIMITS), null);
});

test("classifyPath never reads secrets and credentials", () => {
  for (const p of [".env", ".env.local", ".env.production", "config/.env", "keys/server.pem", "id_rsa", "certs/app.p12", "secrets.json", "credentials.json", "terraform.tfstate", "prod.tfvars", ".npmrc", "gcp/service-account-prod.json"]) {
    assert.equal(classifyPath(p, 10, LIMITS), "sensitive_file", p);
  }
  for (const p of [".env.example", ".env.sample", ".env.template"]) assert.equal(classifyPath(p, 10, LIMITS), null, p);
});

test("classifyPath handles generated, minified, binary, empty and oversize files", () => {
  assert.equal(classifyPath("package-lock.json", 10, LIMITS), "generated");
  assert.equal(classifyPath("yarn.lock", 10, LIMITS), "generated");
  assert.equal(classifyPath("static/app.min.js", 10, LIMITS), "minified");
  assert.equal(classifyPath("static/app.js.map", 10, LIMITS), "minified");
  assert.equal(classifyPath("img/logo.PNG", 10, LIMITS), "binary");
  assert.equal(classifyPath("models/net.pt", 10, LIMITS), "binary");
  assert.equal(classifyPath("a.js", 0, LIMITS), "empty");
  assert.equal(classifyPath("big.js", 1001, LIMITS), "too_large");
  assert.equal(classifyPath("data/nb.ipynb", 4000, LIMITS), null);
  assert.equal(classifyPath("data/nb.ipynb", 6000, LIMITS), "too_large");
  assert.equal(classifyPath("src/app.js", 500, LIMITS), null);
});

test("languages and kinds come from file names", () => {
  assert.equal(detectLanguage("src/App.tsx"), "TypeScript");
  assert.equal(detectLanguage("train.py"), "Python");
  assert.equal(detectLanguage("Dockerfile"), "Dockerfile");
  assert.equal(detectLanguage("docker/Dockerfile.dev"), "Dockerfile");
  assert.equal(detectLanguage("notebooks/a.ipynb"), "Jupyter Notebook");
  assert.equal(detectLanguage("lib/main.dart"), "Dart");
  assert.equal(detectLanguage("README"), "Markdown");
  assert.equal(detectLanguage("weird.xyz"), "Other");
  assert.equal(fileKind("Python"), "source");
  assert.equal(fileKind("JSON"), "config");
  assert.equal(fileKind("Markdown"), "docs");
  assert.equal(fileKind("CSV"), "data");
});

test("pathPriority keeps manifests first and tests/data last", () => {
  assert.equal(pathPriority("README.md", "docs"), 0);
  assert.equal(pathPriority("server/package.json", "config"), 0);
  assert.equal(pathPriority("src/app.js", "source"), 1);
  assert.equal(pathPriority("docs/guide.md", "docs"), 3);
  assert.equal(pathPriority("src/app.test.js", "source"), 3);
  assert.equal(pathPriority("data/x.csv", "data"), 3);
});

// ---------- secrets ----------
test("scanAndRedact removes real-looking credentials but keeps line structure", () => {
  const input = [
    'const aws = "AKIAABCDEFGHIJKLMNOP";',
    "const gh = 'ghp_" + "a".repeat(36) + "';",
    'const db = "mongodb+srv://admin:Sup3rS3cret@cluster0.mongodb.net/app";',
    'const apiKey = "Zx81kLmQ9pRt4VwYb2NcD7";',
    'const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r";',
    "const ok = 1;",
  ].join("\n");
  const r = scanAndRedact(input);
  assert.equal(r.privateKey, false);
  assert.equal(r.redactions, 5);
  assert.equal(r.content.split("\n").length, input.split("\n").length);
  for (const secret of ["AKIAABCDEFGHIJKLMNOP", "Sup3rS3cret", "Zx81kLmQ9pRt4VwYb2NcD7", "ghp_" + "a".repeat(36), "dBjftJeZ4CVPmB92K27uhbUJU1p1r"]) {
    assert.ok(!r.content.includes(secret), `still contains ${secret}`);
  }
  assert.ok(r.content.includes("mongodb+srv://admin:[REDACTED]@cluster0"));
  assert.ok(r.content.includes("const ok = 1;"));
});

test("scanAndRedact does not touch ordinary code and placeholders", () => {
  const input = [
    "const password = process.env.DB_PASSWORD;",
    'password = "your-password-here"',
    'API_KEY = "<your api key>"',
    'const token = "Bearer";',
    'password_field = "password_confirmation"',
    'secret = "${SECRET_FROM_VAULT}"',
    'const label = "authentication_token_name";',
    "function login(password) { return hash(password); }",
  ].join("\n");
  const r = scanAndRedact(input);
  assert.equal(r.redactions, 0, r.content);
  assert.equal(r.content, input);
});

test("scanAndRedact flags private keys so the whole file can be dropped", () => {
  const r = scanAndRedact("x\n-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n");
  assert.equal(r.privateKey, true);
  assert.equal(r.content, "");
  assert.equal(scanAndRedact("-----BEGIN OPENSSH PRIVATE KEY-----").privateKey, true);
  assert.equal(scanAndRedact("-----BEGIN PUBLIC KEY-----").privateKey, false);
});

// ---------- notebooks ----------
test("notebookToText keeps cell sources and drops outputs", () => {
  const nb = JSON.stringify({
    cells: [
      { cell_type: "markdown", source: ["# Title\n", "Intro"] },
      { cell_type: "code", source: ["import pandas as pd\n", "df = pd.read_csv('a.csv')"], outputs: [{ data: { "image/png": "A".repeat(500) } }] },
      { cell_type: "raw", source: "ignored" },
    ],
  });
  const text = notebookToText(nb);
  assert.ok(text.includes("# %% [markdown]\n# # Title\n# Intro"));
  assert.ok(text.includes("# %% [code]\nimport pandas as pd\ndf = pd.read_csv('a.csv')"));
  assert.ok(!text.includes("AAAA"));
  assert.ok(!text.includes("ignored"));
  assert.equal(notebookToText("not json"), null);
  assert.equal(notebookToText('{"foo":1}'), null);
});

// ---------- path safety ----------
test("safeRelativePath rejects traversal and odd paths", () => {
  assert.equal(safeRelativePath("src/app.js"), "src/app.js");
  for (const bad of ["../x", "a/../../x", "/etc/passwd", "a//b", "a/./b", "a\\b", "C:/x", "a\0b", "", "x".repeat(501), null, 5]) {
    assert.equal(safeRelativePath(bad), null, String(bad));
  }
});

// ---------- extractor ----------
async function tarOf(entries) {
  const pack = tar.pack();
  pack.entry({ name: "root/", type: "directory" });
  for (const e of entries) pack.entry(e.header ?? { name: `root/${e.path}` }, e.body ?? "");
  pack.finalize();
  return pack;
}

test("extractRepoFiles stores text files and reports exactly what it skipped", async () => {
  const entries = [
    { path: "README.md", body: "# Hi\r\nline2\r\n" },
    { path: "src/app.js", body: "const a = 1;\nconst b = 2;\n" },
    { path: "src/secret.js", body: 'const k = "AKIAABCDEFGHIJKLMNOP";\n' },
    { path: ".env", body: "TOKEN=abc" },
    { path: "node_modules/x/i.js", body: "x" },
    { path: "img.png", body: Buffer.from([1, 2, 3]) },
    { path: "blob.dat2", body: Buffer.from([65, 0, 66, 0]) },
    { path: "big.js", body: "a".repeat(2000) },
    { path: "keys/server.js", body: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" },
    { path: "package-lock.json", body: "{}" },
    { path: "empty.js", body: "" },
    { header: { name: "root/link.js", type: "symlink", linkname: "/etc/passwd" } },
    { header: { name: "root/../evil.js" }, body: "evil" },
    { header: { name: "root//double.js" }, body: "x" },
  ];
  const { files, stats } = await extractRepoFiles(await tarOf(entries), LIMITS);

  assert.deepEqual(files.map((f) => f.path), ["README.md", "src/app.js", "src/secret.js"]);
  const readme = files[0];
  assert.equal(readme.content, "# Hi\nline2\n");
  assert.equal(readme.lines, 2);
  assert.equal(readme.language, "Markdown");
  assert.equal(readme.kind, "docs");
  assert.equal(readme.contentHash, createHash("sha256").update("# Hi\nline2\n").digest("hex"));

  const secret = files[2];
  assert.equal(secret.redactions, 1);
  assert.ok(!secret.content.includes("AKIA"));

  assert.equal(stats.storedFiles, 3);
  assert.equal(stats.redactedFiles, 1);
  assert.equal(stats.truncated, false);
  assert.equal(stats.skipped.sensitive_file, 1);
  assert.equal(stats.skipped.ignored_dir, 1);
  assert.equal(stats.skipped.binary, 2);
  assert.equal(stats.skipped.too_large, 1);
  assert.equal(stats.skipped.contains_secret, 1);
  assert.equal(stats.skipped.generated, 1);
  assert.equal(stats.skipped.empty, 1);
  assert.equal(stats.skipped.link, 1);
  assert.equal(stats.skipped.unsafe_path, 2);

  const dump = JSON.stringify(files);
  for (const bad of ["evil", "BEGIN PRIVATE KEY", "TOKEN=abc", "/etc/passwd"]) assert.ok(!dump.includes(bad), bad);
});

test("extractRepoFiles converts notebooks without their outputs", async () => {
  const nb = JSON.stringify({ cells: [{ cell_type: "code", source: "x = 1", outputs: [{ text: "Z".repeat(300) }] }] });
  const { files } = await extractRepoFiles(await tarOf([{ path: "nb/a.ipynb", body: nb }]), LIMITS);
  assert.equal(files.length, 1);
  assert.equal(files[0].language, "Jupyter Notebook");
  assert.ok(files[0].content.includes("x = 1"));
  assert.ok(!files[0].content.includes("ZZZ"));
  assert.ok(files[0].note);
  const bad = await extractRepoFiles(await tarOf([{ path: "bad.ipynb", body: "{nope" }]), LIMITS);
  assert.equal(bad.files.length, 0);
  assert.equal(bad.stats.skipped.unreadable, 1);
});

test("when a repo exceeds the limits, manifests and source win over tests and docs", async () => {
  const entries = [
    { path: "a_tests/one.test.js", body: "t1\n" },
    { path: "a_tests/two.test.js", body: "t2\n" },
    { path: "docs/guide.md", body: "guide\n" },
    { path: "src/main.js", body: "main\n" },
    { path: "src/util.js", body: "util\n" },
    { path: "package.json", body: "{}\n" },
    { path: "README.md", body: "readme\n" },
  ];
  const { files, stats } = await extractRepoFiles(await tarOf(entries), { ...LIMITS, maxFiles: 4 });
  assert.deepEqual(files.map((f) => f.path).sort(), ["README.md", "package.json", "src/main.js", "src/util.js"]);
  assert.equal(stats.truncated, true);
  assert.equal(stats.skipped.over_limit, 3);
  assert.equal(stats.storedFiles, 4);

  const bytes = await extractRepoFiles(await tarOf(entries), { ...LIMITS, maxTotalContentBytes: 30 });
  assert.ok(bytes.stats.storedBytes <= 30);
  assert.equal(bytes.stats.truncated, true);
});

test("extractRepoFiles prunes correctly with many files", async () => {
  const entries = Array.from({ length: 60 }, (_, i) => ({ path: `src/f${String(i).padStart(2, "0")}.js`, body: `x${i}\n` }));
  entries.push({ path: "package.json", body: "{}\n" });
  const { files, stats } = await extractRepoFiles(await tarOf(entries), { ...LIMITS, maxFiles: 10 });
  assert.equal(files.length, 10);
  assert.ok(files.some((f) => f.path === "package.json"));
  assert.equal(stats.skipped.over_limit, 51);
});

test("a corrupt tar stream rejects instead of hanging or returning partial data", async () => {
  const garbage = Readable.from([Buffer.alloc(600, 7)]);
  await assert.rejects(extractRepoFiles(garbage, LIMITS));
});

// ---------- downloader ----------
const realFetch = globalThis.fetch;
const withFetch = async (impl, fn) => {
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
};
const REF = { owner: "o", repo: "r", sha: "abc1234" };

test("openSnapshotStream downloads the exact commit and feeds the extractor", async () => {
  const body = await makeTarGz("o-r-abc1234", { "src/a.js": "a\n", "README.md": "r\n" });
  let requested;
  const { files } = await withFetch(
    async (url) => {
      requested = String(url);
      return new Response(body, { status: 200 });
    },
    async () => extractRepoFiles(await openSnapshotStream(REF), LIMITS)
  );
  assert.equal(requested, "https://codeload.github.com/o/r/tar.gz/abc1234");
  assert.deepEqual(files.map((f) => f.path), ["README.md", "src/a.js"]);
});

test("openSnapshotStream maps GitHub failures to friendly errors", async () => {
  const cases = [
    [() => new Response("nope", { status: 404 }), 404, "snapshot_unavailable"],
    [() => new Response("slow down", { status: 429 }), 429, "github_rate_limited"],
    [() => new Response("x", { status: 500 }), 502, "github_error"],
    [() => new Response("x", { status: 403, headers: { "x-ratelimit-remaining": "0" } }), 429, "github_rate_limited"],
  ];
  for (const [make, status, code] of cases) {
    await withFetch(async () => make(), async () => {
      await assert.rejects(openSnapshotStream(REF), (e) => e.status === status && e.code === code, code);
    });
  }
  await withFetch(
    async () => {
      throw new TypeError("fetch failed");
    },
    async () => assert.rejects(openSnapshotStream(REF), (e) => e.code === "github_unreachable")
  );
});

test("openSnapshotStream refuses oversized archives (declared and actual) and gzip bombs", async () => {
  const body = await makeTarGz("o-r-abc1234", { "src/a.js": "a".repeat(5000) });

  await withFetch(async () => new Response(body, { status: 200, headers: { "content-length": String(body.length) } }), async () => {
    await assert.rejects(openSnapshotStream(REF, { maxArchiveBytes: 10 }), (e) => e.status === 413 && e.code === "repo_too_large");
  });

  await withFetch(async () => new Response(Readable.toWeb(Readable.from([body])), { status: 200 }), async () => {
    const stream = await openSnapshotStream(REF, { maxArchiveBytes: 20 });
    await assert.rejects(extractRepoFiles(stream, LIMITS), (e) => e.code === "repo_too_large");
  });

  const bomb = zlib.gzipSync(Buffer.alloc(200_000, 0));
  await withFetch(async () => new Response(bomb, { status: 200 }), async () => {
    const stream = await openSnapshotStream(REF, { maxUncompressedBytes: 10_000 });
    await assert.rejects(extractRepoFiles(stream, LIMITS), (e) => e.code === "repo_too_large");
  });
});

test("openSnapshotStream reports a truncated gzip as a retryable error", async () => {
  const body = await makeTarGz("o-r-abc1234", { "src/a.js": "a\n" });
  await withFetch(async () => new Response(body.subarray(0, 20), { status: 200 }), async () => {
    const stream = await openSnapshotStream(REF);
    await assert.rejects(extractRepoFiles(stream, LIMITS), (e) => e.code === "download_failed");
  });
});
