import { AppError } from "../utils/errors.js";

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Parses a public GitHub repository URL into { owner, repo, url, key }.
 * Accepts https://github.com/owner/repo, with optional .git, trailing slash,
 * or /tree/... /blob/... suffixes. Anything else is rejected.
 */
export function parseGithubUrl(input) {
  const invalid = (msg) => new AppError(400, msg, "invalid_github_url", { url: [msg] });

  if (typeof input !== "string" || !input.trim()) throw invalid("Enter a GitHub repository URL");
  let raw = input.trim();
  if (raw.length > 300) throw invalid("That URL is too long");
  if (/^(www\.)?github\.com\//i.test(raw)) raw = "https://" + raw;

  let u;
  try {
    u = new URL(raw);
  } catch {
    throw invalid("That doesn't look like a valid URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw invalid("Only https://github.com URLs are supported");
  if (!["github.com", "www.github.com"].includes(u.hostname.toLowerCase())) throw invalid("Only github.com repositories are supported");
  if (u.username || u.password) throw invalid("URLs with credentials are not allowed");

  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 2) throw invalid("Use the form https://github.com/owner/repository");
  if (parts.length > 2 && !["tree", "blob", "commit", "commits", "pulls", "issues"].includes(parts[2])) {
    throw invalid("Use the repository's main URL: https://github.com/owner/repository");
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo === "." || repo === "..") {
    throw invalid("That owner or repository name is not valid");
  }
  return { owner, repo, url: `https://github.com/${owner}/${repo}`, key: `${owner}/${repo}`.toLowerCase() };
}
