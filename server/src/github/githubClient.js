import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

const API = "https://api.github.com";
const TIMEOUT_MS = 12000;

async function ghFetch(path) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CodeMate",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (env.githubToken) headers.Authorization = `Bearer ${env.githubToken}`;

  let res;
  try {
    res = await fetch(API + path, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new AppError(504, "GitHub took too long to respond. Please try again.", "github_timeout");
    }
    throw new AppError(502, "Could not reach GitHub. Check your connection and try again.", "github_unreachable");
  }
  return res;
}

function rateLimited(res) {
  return res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");
}

function rateLimitError(res) {
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  const when = reset ? ` Try again after ${new Date(reset * 1000).toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC.` : "";
  return new AppError(429, `GitHub's API rate limit was reached.${when} Setting GITHUB_TOKEN on the server raises the limit.`, "github_rate_limited");
}

/**
 * Fetches metadata for a public repository and the commit SHA at the head of
 * its default branch. Never downloads or runs repository code.
 */
export async function fetchRepoSnapshot({ owner, repo }) {
  const repoRes = await ghFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (rateLimited(repoRes)) throw rateLimitError(repoRes);
  if (repoRes.status === 404 || repoRes.status === 403 || repoRes.status === 401) {
    throw new AppError(404, "Repository not found, or it is private. Only public GitHub repositories are supported.", "repo_not_found", {
      url: ["Repository not found or not public"],
    });
  }
  if (repoRes.status === 451) throw new AppError(451, "GitHub has blocked access to this repository.", "repo_blocked");
  if (!repoRes.ok) throw new AppError(502, `GitHub returned an unexpected error (${repoRes.status}).`, "github_error");

  const meta = await repoRes.json();
  if (meta.private) {
    throw new AppError(400, "Private repositories are not supported yet. Please import a public repository.", "repo_private", {
      url: ["Private repositories are not supported yet"],
    });
  }
  if (!meta.default_branch) throw new AppError(422, "This repository has no default branch.", "no_default_branch");

  const commitRes = await ghFetch(
    `/repos/${encodeURIComponent(meta.owner.login)}/${encodeURIComponent(meta.name)}/commits/${encodeURIComponent(meta.default_branch)}`
  );
  if (rateLimited(commitRes)) throw rateLimitError(commitRes);
  if (commitRes.status === 409 || commitRes.status === 404 || commitRes.status === 422) {
    throw new AppError(422, "This repository is empty or its default branch has no commits.", "repo_empty", {
      url: ["Repository has no commits to import"],
    });
  }
  if (!commitRes.ok) throw new AppError(502, `GitHub returned an unexpected error (${commitRes.status}).`, "github_error");
  const commit = await commitRes.json();
  if (!commit.sha) throw new AppError(502, "GitHub did not return a commit for the default branch.", "github_error");

  return {
    repoOwner: meta.owner.login,
    repoName: meta.name,
    githubUrl: meta.html_url,
    defaultBranch: meta.default_branch,
    snapshotSha: commit.sha,
    repoDescription: (meta.description || "").slice(0, 1000),
    githubLanguage: meta.language || "",
    stars: meta.stargazers_count || 0,
    repoSizeKb: meta.size || 0,
  };
}
