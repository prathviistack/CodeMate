import { Readable, Transform, PassThrough, pipeline } from "stream";
import zlib from "zlib";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

const mb = (n) => Math.round(n / 1024 / 1024);

function byteLimiter(limit, makeError) {
  let seen = 0;
  return new Transform({
    transform(chunk, enc, cb) {
      seen += chunk.length;
      if (seen > limit) return cb(makeError());
      cb(null, chunk);
    },
  });
}

/**
 * Opens the repository snapshot at an exact commit as an uncompressed tar stream.
 * codeload.github.com serves public archives without using the REST API quota.
 * Download size, decompressed size and total time are all bounded.
 */
export async function openSnapshotStream({ owner, repo, sha }, limits = {}) {
  const L = { ...env.ingestion, ...limits };
  const signal = limits.signal ? AbortSignal.any([limits.signal, AbortSignal.timeout(L.timeoutMs)]) : AbortSignal.timeout(L.timeoutMs);
  const url = `https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tar.gz/${encodeURIComponent(sha)}`;

  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": "CodeMate" }, signal });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new AppError(504, "GitHub took too long to send the repository. Please retry.", "github_timeout");
    }
    throw new AppError(502, "Could not reach GitHub to download the repository. Please retry.", "github_unreachable");
  }

  if (res.status === 404 || res.status === 401 || res.status === 403) {
    if (res.headers.get("x-ratelimit-remaining") === "0") {
      throw new AppError(429, "GitHub's rate limit was reached. Please retry in a few minutes.", "github_rate_limited");
    }
    throw new AppError(404, "The repository snapshot could not be downloaded. It may have been deleted or made private.", "snapshot_unavailable");
  }
  if (res.status === 429) throw new AppError(429, "GitHub's rate limit was reached. Please retry in a few minutes.", "github_rate_limited");
  if (!res.ok || !res.body) throw new AppError(502, `GitHub returned an unexpected error (${res.status}).`, "github_error");

  const declared = Number(res.headers.get("content-length"));
  if (declared && declared > L.maxArchiveBytes) {
    res.body.cancel?.().catch(() => {});
    throw new AppError(413, `This repository is ${mb(declared)} MB compressed, over the ${mb(L.maxArchiveBytes)} MB import limit.`, "repo_too_large");
  }

  const tooBig = () => new AppError(413, `This repository is larger than the ${mb(L.maxArchiveBytes)} MB import limit.`, "repo_too_large");
  const bomb = () => new AppError(413, "The repository expands to more data than CodeMate can safely import.", "repo_too_large");

  const gunzip = zlib.createGunzip();
  const body = Readable.fromWeb(res.body);
  // `out` is what the caller reads. It is kept OUT of the pipeline so that, when something
  // upstream fails, we decide which (friendly) error it is destroyed with.
  const out = new PassThrough();
  const tail = byteLimiter(L.maxUncompressedBytes, bomb);

  pipeline(body, byteLimiter(L.maxArchiveBytes, tooBig), gunzip, tail, (err) => {
    if (!err) return;
    if (err instanceof AppError) return out.destroy(err);
    // Timeouts/aborts and corrupt or truncated gzip data surface as raw stream errors.
    out.destroy(
      err.name === "TimeoutError" || err.name === "AbortError"
        ? new AppError(504, "GitHub took too long to send the repository. Please retry.", "github_timeout")
        : new AppError(502, "The repository download was interrupted or corrupted. Please retry.", "download_failed")
    );
  });
  tail.pipe(out);
  return out;
}
