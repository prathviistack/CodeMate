import { BaseAnalyzer } from "./baseAnalyzer.js";

/**
 * Analyzes Python projects by inspecting requirements.txt, setup.py, and pyproject.toml.
 * Detects frameworks, libraries, and other dependencies.
 */
export class PythonAnalyzer extends BaseAnalyzer {
  async analyze(path, content) {
    if (path === "requirements.txt") {
      return this.analyzeRequirements(content);
    }
    if (path === "pyproject.toml") {
      return this.analyzePyproject(content);
    }
    if (path === "setup.py") {
      return this.analyzeSetup(content);
    }
    return null;
  }

  analyzeRequirements(content) {
    const frameworks = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const dep = line.split(/[<>=!]/)[0].trim().toLowerCase();
      if (!dep) continue;

      // Web frameworks
      if (dep === "django") frameworks.push("Django");
      if (dep === "flask") frameworks.push("Flask");
      if (dep === "fastapi") frameworks.push("FastAPI");
      if (dep === "tornado") frameworks.push("Tornado");
      if (dep === "aiohttp") frameworks.push("Aiohttp");
      if (dep === "bottle") frameworks.push("Bottle");
      if (dep === "pyramid") frameworks.push("Pyramid");
      if (dep === "starlette") frameworks.push("Starlette");

      // Testing
      if (dep === "pytest") frameworks.push("pytest");
      if (dep === "unittest2") frameworks.push("unittest");

      // Data science / ML
      if (dep === "pandas") frameworks.push("Pandas");
      if (dep === "numpy") frameworks.push("NumPy");
      if (dep === "scikit-learn") frameworks.push("scikit-learn");
      if (dep === "tensorflow") frameworks.push("TensorFlow");
      if (dep === "torch") frameworks.push("PyTorch");
      if (dep === "keras") frameworks.push("Keras");

      // ORM/DB
      if (dep === "sqlalchemy") frameworks.push("SQLAlchemy");
      if (dep === "psycopg2" || dep === "psycopg2-binary") frameworks.push("PostgreSQL");

      // Async
      if (dep === "aiohttp") frameworks.push("aiohttp");
    }

    return {
      languages: ["Python"],
      frameworks: [...new Set(frameworks)],
    };
  }

  analyzePyproject(content) {
    // Simple text-based parsing for toml-like content
    const frameworks = [];

    // Look for common framework markers
    if (content.includes("fastapi") || content.includes('"fastapi"')) frameworks.push("FastAPI");
    if (content.includes("django") || content.includes('"django"')) frameworks.push("Django");
    if (content.includes("flask") || content.includes('"flask"')) frameworks.push("Flask");
    if (content.includes("pytest") || content.includes('"pytest"')) frameworks.push("pytest");
    if (content.includes("numpy") || content.includes('"numpy"')) frameworks.push("NumPy");
    if (content.includes("pandas") || content.includes('"pandas"')) frameworks.push("Pandas");
    if (content.includes("tensorflow") || content.includes('"tensorflow"')) frameworks.push("TensorFlow");
    if (content.includes("torch") || content.includes('"torch"')) frameworks.push("PyTorch");
    if (content.includes("sqlalchemy") || content.includes('"sqlalchemy"')) frameworks.push("SQLAlchemy");

    return {
      languages: ["Python"],
      frameworks: [...new Set(frameworks)],
    };
  }

  analyzeSetup(content) {
    // Simple text-based parsing for setup.py
    const frameworks = [];

    // Look for install_requires patterns
    const requiresMatch = content.match(/install_requires\s*=\s*\[(.*?)\]/s);
    if (requiresMatch) {
      const reqs = requiresMatch[1];
      if (reqs.includes("django")) frameworks.push("Django");
      if (reqs.includes("flask")) frameworks.push("Flask");
      if (reqs.includes("fastapi")) frameworks.push("FastAPI");
      if (reqs.includes("pytest")) frameworks.push("pytest");
      if (reqs.includes("numpy")) frameworks.push("NumPy");
      if (reqs.includes("pandas")) frameworks.push("Pandas");
    }

    return {
      languages: ["Python"],
      frameworks: [...new Set(frameworks)],
    };
  }
}
