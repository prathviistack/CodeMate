// highlight.js is loaded on demand so it never weighs down pages that don't show code.
const HLJS_NAMES = {
  JavaScript: "javascript", TypeScript: "typescript", Python: "python", "Jupyter Notebook": "python",
  Java: "java", Kotlin: "kotlin", Swift: "swift", Go: "go", Rust: "rust", C: "c", "C++": "cpp", "C#": "csharp",
  PHP: "php", Ruby: "ruby", Shell: "bash", SQL: "sql", HTML: "xml", XML: "xml", Vue: "xml", Svelte: "xml",
  CSS: "css", SCSS: "scss", Less: "less", JSON: "json", YAML: "yaml", TOML: "ini", Config: "ini",
  Markdown: "markdown", Dockerfile: "dockerfile", Makefile: "makefile", "Objective-C": "objectivec",
  Scala: "scala", Lua: "lua", R: "r", Perl: "perl", PowerShell: "powershell", GraphQL: "graphql",
};

let hljsPromise;
const loadHljs = () => (hljsPromise ??= import("highlight.js/lib/common").then((m) => m.default));

// hljs output can contain <span> that spans several lines. Split into per-line HTML,
// closing and re-opening spans at each newline so every line is self-contained.
export function splitHighlightedLines(html) {
  const lines = [];
  const stack = [];
  let cur = "";
  let last = 0;
  const re = /(<span[^>]*>|<\/span>|\n)/g;
  let m;
  while ((m = re.exec(html))) {
    cur += html.slice(last, m.index);
    last = re.lastIndex;
    const t = m[0];
    if (t === "\n") {
      cur += "</span>".repeat(stack.length);
      lines.push(cur);
      cur = stack.join("");
    } else if (t === "</span>") {
      stack.pop();
      cur += t;
    } else {
      stack.push(t);
      cur += t;
    }
  }
  lines.push(cur + html.slice(last));
  return lines;
}

/** Returns per-line highlighted HTML, or null if the language is unsupported or the file is too big. */
export async function highlightLines(code, language) {
  const name = HLJS_NAMES[language];
  if (!name || code.length > 200_000) return null;
  const hljs = await loadHljs();
  if (!hljs.getLanguage(name)) return null;
  try {
    return splitHighlightedLines(hljs.highlight(code, { language: name, ignoreIllegals: true }).value);
  } catch {
    return null;
  }
}
