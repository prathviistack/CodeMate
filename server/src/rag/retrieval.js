import RepoFile from "../models/RepoFile.js";

/**
 * Retrieves the most relevant code files for a query using keyword matching.
 * Returns an ordered list of files with excerpt excerpts.
 */
export async function retrieveRelevantFiles(projectId, query, limit = 5) {
  const files = await RepoFile.find({ projectId }).select("path content language kind").lean();
  if (!files.length) return [];

  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (!queryTerms.length) return [];

  // Score each file by keyword matches
  const scored = files.map((file) => {
    const contentLower = file.content.toLowerCase();
    const pathLower = file.path.toLowerCase();
    let score = 0;

    // Path matches weight heavily
    for (const term of queryTerms) {
      if (pathLower.includes(term)) score += 10;
    }

    // Content matches
    for (const term of queryTerms) {
      const matches = contentLower.match(new RegExp(term, "g")) || [];
      score += matches.length;
    }

    // Boost source files, penalize unrelated files
    if (file.kind === "source") score *= 1.5;
    if (file.kind === "data") score *= 0.5;

    return { ...file, score };
  });

  // Return top matches with excerpts
  return scored
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((file) => ({
      path: file.path,
      language: file.language,
      excerpt: extractRelevantExcerpt(file.content, queryTerms),
      kind: file.kind,
      score: file.score,
    }));
}

/**
 * Extracts a relevant excerpt from file content around query terms.
 */
function extractRelevantExcerpt(content, queryTerms) {
  const lines = content.split("\n");

  // Find first line with any query term
  let matchLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (queryTerms.some((t) => lower.includes(t))) {
      matchLine = i;
      break;
    }
  }

  if (matchLine === -1) return content.split("\n").slice(0, 3).join("\n");

  // Return lines around the match (context window)
  const start = Math.max(0, matchLine - 2);
  const end = Math.min(lines.length, matchLine + 5);
  return lines.slice(start, end).join("\n");
}

/**
 * Get codebase summary for context: list of frameworks, languages, key files
 */
export async function getCodebaseSummary(projectId) {
  const files = await RepoFile.find({ projectId }).select("path language kind").lean();

  const languages = new Set();
  const sourceFiles = [];
  const configFiles = [];

  for (const file of files) {
    if (file.language && file.language !== "Other") {
      languages.add(file.language);
    }
    if (file.kind === "source") sourceFiles.push(file.path);
    if (file.kind === "config") configFiles.push(file.path);
  }

  return {
    totalFiles: files.length,
    languages: Array.from(languages).sort(),
    topSourceFiles: sourceFiles.slice(0, 5),
    configFiles: configFiles.slice(0, 5),
  };
}
