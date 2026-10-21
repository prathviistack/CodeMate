/**
 * Base analyzer interface. Each analyzer detects languages and frameworks
 * from manifest files stored in the repository.
 */
export class BaseAnalyzer {
  /**
   * Detects languages and frameworks from this manifest file.
   * Returns { languages: string[], frameworks: string[] } or null if not applicable.
   */
  async analyze(path, content) {
    throw new Error("analyze() not implemented");
  }

  /**
   * Parse JSON safely, returning null on error.
   */
  parseJson(content) {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}
