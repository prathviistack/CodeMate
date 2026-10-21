import RepoFile from "../models/RepoFile.js";
import { JavaScriptAnalyzer } from "./analyzers/javascriptAnalyzer.js";
import { PythonAnalyzer } from "./analyzers/pythonAnalyzer.js";
import { RubyAnalyzer } from "./analyzers/rubyAnalyzer.js";
import { JavaAnalyzer } from "./analyzers/javaAnalyzer.js";
import { GoAnalyzer } from "./analyzers/goAnalyzer.js";
import { RustAnalyzer } from "./analyzers/rustAnalyzer.js";

/**
 * Analyzes a repository by running all manifest-based analyzers.
 * Returns { languages, frameworks, summary } with detected technologies and metadata.
 */
export async function analyzeRepository(projectId) {
  const analyzers = [
    new JavaScriptAnalyzer(),
    new PythonAnalyzer(),
    new RubyAnalyzer(),
    new JavaAnalyzer(),
    new GoAnalyzer(),
    new RustAnalyzer(),
  ];

  // Load all project files
  const files = await RepoFile.find({ projectId }).select("path content language").lean();
  const fileMap = new Map(files.map((f) => [f.path, f]));

  // Run all analyzers
  const allLanguages = new Set();
  const allFrameworks = new Set();
  const manifests = [];

  for (const analyzer of analyzers) {
    for (const [path, file] of fileMap) {
      const result = await analyzer.analyze(path, file.content);
      if (result) {
        result.languages.forEach((l) => allLanguages.add(l));
        result.frameworks.forEach((f) => allFrameworks.add(f));
        manifests.push({ path, frameworks: result.frameworks });
      }
    }
  }

  // Collect languages from all files (not just manifests)
  for (const file of files) {
    if (file.language && file.language !== "Other") {
      allLanguages.add(file.language);
    }
  }

  // Generate summary
  const languages = Array.from(allLanguages).sort();
  const frameworks = Array.from(allFrameworks).sort();
  const summary = generateSummary(languages, frameworks, manifests);

  return { languages, frameworks, summary };
}

/**
 * Generates a human-readable summary of the detected technologies.
 * Summary includes primary language, frameworks, and detected tools.
 */
function generateSummary(languages, frameworks, manifests) {
  const parts = [];

  if (languages.length > 0) {
    parts.push(languages.join(", "));
  }

  if (frameworks.length > 0) {
    parts.push(`using ${frameworks.slice(0, 3).join(", ")}${frameworks.length > 3 ? " and more" : ""}`);
  }

  if (parts.length === 0) {
    return "Codebase with mixed technologies";
  }

  if (parts.length === 1) {
    return `${parts[0]} codebase`;
  }

  return `${parts[0]} project ${parts[1]}`;
}
