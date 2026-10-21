import { createHash } from "crypto";
import { pipeline } from "stream/promises";
import tar from "tar-stream";
import { env } from "../config/env.js";
import { detectLanguage, fileKind } from "../code-analysis/languages.js";
import { classifyPath, pathPriority } from "../code-analysis/fileFilter.js";
import { scanAndRedact } from "../code-analysis/secrets.js";
import { notebookToText } from "../code-analysis/notebook.js";

/** Safe repository-relative path, or null. Nothing here is ever written to disk. */
export function safeRelativePath(name) {
  if (typeof name !== "string" || name.length === 0 || name.length > 500) return null;
  if (name.includes("\0") || name.includes("\\") || name.startsWith("/") || /^[A-Za-z]:/.test(name)) return null;
  const segments = name.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) return null;
  return segments.join("/");
}

async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/**
 * Reads an UNCOMPRESSED tar stream of a GitHub repository snapshot, in memory, and returns the
 * text files worth keeping. No file is written to disk and nothing is executed.
 *
 * @returns {Promise<{ files: object[], stats: object }>}
 */
export async function extractRepoFiles(source, overrides = {}) {
  const L = { ...env.ingestion, ...overrides };
  const skipped = {};
  const skip = (reason) => {
    skipped[reason] = (skipped[reason] || 0) + 1;
  };

  let kept = [];
  let keptBytes = 0;
  let fileEntries = 0;
  let truncated = false;

  // Keep the most useful files when a repository is bigger than our storage limits.
  const prune = () => {
    const order = [...kept].sort((a, b) => a.priority - b.priority || a.size - b.size || (a.path < b.path ? -1 : 1));
    const next = [];
    let bytes = 0;
    for (const f of order) {
      if (next.length < L.maxFiles && bytes + f.size <= L.maxTotalContentBytes) {
        next.push(f);
        bytes += f.size;
      } else {
        skip("over_limit");
        truncated = true;
      }
    }
    kept = next;
    keptBytes = bytes;
  };

  const extract = tar.extract();

  extract.on("entry", (header, stream, next) => {
    (async () => {
      if (header.type !== "file") {
        stream.resume();
        if (header.type === "symlink" || header.type === "link") skip("link");
        return;
      }
      fileEntries++;

      // Drop the archive's top-level "<owner>-<repo>-<sha>/" folder.
      const slash = header.name.indexOf("/");
      const rel = slash === -1 ? null : safeRelativePath(header.name.slice(slash + 1));
      if (!rel) {
        stream.resume();
        skip("unsafe_path");
        return;
      }
      if (fileEntries > L.maxEntries) {
        stream.resume();
        skip("over_limit");
        truncated = true;
        return;
      }

      const reason = classifyPath(rel, header.size, L);
      if (reason) {
        stream.resume();
        skip(reason);
        return;
      }

      const buf = await readAll(stream);
      if (buf.subarray(0, 8000).includes(0)) return skip("binary");

      let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      const replacement = (text.match(/�/g) || []).length;
      if (replacement > 3 && replacement / text.length > 0.01) return skip("binary");
      text = text.replace(/\r\n?/g, "\n");

      let language = detectLanguage(rel);
      let note = "";
      if (language === "Jupyter Notebook") {
        const converted = notebookToText(text);
        if (converted === null) return skip("unreadable");
        if (Buffer.byteLength(converted) > L.maxFileBytes) return skip("too_large");
        text = converted;
        note = "Notebook cell sources only. Outputs are not stored.";
      }

      const scan = scanAndRedact(text);
      if (scan.privateKey) return skip("contains_secret");
      text = scan.content;

      const kind = fileKind(language);
      const size = Buffer.byteLength(text);
      kept.push({
        path: rel,
        language,
        kind,
        size,
        lines: text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length,
        content: text,
        contentHash: createHash("sha256").update(text).digest("hex"),
        redactions: scan.redactions,
        note,
        priority: pathPriority(rel, kind),
      });
      keptBytes += size;

      // Prune with 25% headroom so we sort rarely, not on every file.
      if (kept.length > L.maxFiles * 1.25 || keptBytes > L.maxTotalContentBytes * 1.25) prune();
    })().then(
      () => next(),
      (err) => extract.destroy(err)
    );
  });

  await pipeline(source, extract);

  if (kept.length > L.maxFiles || keptBytes > L.maxTotalContentBytes) prune();
  kept.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const skippedTotal = Object.values(skipped).reduce((a, b) => a + b, 0);
  const files = kept.map(({ priority, ...f }) => f);
  return {
    files,
    stats: {
      totalFiles: fileEntries,
      storedFiles: files.length,
      storedBytes: keptBytes,
      skippedFiles: skippedTotal,
      skipped,
      truncated,
      redactedFiles: files.filter((f) => f.redactions > 0).length,
    },
  };
}
