// Maps file names / extensions to a language label. This is evidence from file
// names only. It says nothing about frameworks (that comes from manifests in Phase 5).

const BY_EXT = {
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  py: "Python", pyi: "Python", ipynb: "Jupyter Notebook",
  java: "Java", kt: "Kotlin", kts: "Kotlin", scala: "Scala", groovy: "Groovy",
  swift: "Swift", m: "Objective-C", mm: "Objective-C", dart: "Dart",
  go: "Go", rs: "Rust", c: "C", h: "C", cpp: "C++", cc: "C++", cxx: "C++", hpp: "C++", hh: "C++",
  cs: "C#", fs: "F#", vb: "Visual Basic", php: "PHP", rb: "Ruby", erb: "Ruby",
  lua: "Lua", pl: "Perl", r: "R", jl: "Julia", ex: "Elixir", exs: "Elixir", erl: "Erlang", hs: "Haskell", clj: "Clojure",
  sh: "Shell", bash: "Shell", zsh: "Shell", ps1: "PowerShell", bat: "Batch", cmd: "Batch",
  sql: "SQL", html: "HTML", htm: "HTML", css: "CSS", scss: "SCSS", sass: "SCSS", less: "Less",
  vue: "Vue", svelte: "Svelte", astro: "Astro",
  json: "JSON", jsonc: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", xml: "XML", csproj: "XML", plist: "XML",
  gradle: "Gradle", proto: "Protocol Buffers", graphql: "GraphQL", gql: "GraphQL", tf: "Terraform",
  md: "Markdown", markdown: "Markdown", rst: "reStructuredText", txt: "Text",
  ini: "Config", cfg: "Config", conf: "Config", properties: "Config", env: "Config",
  csv: "CSV", tsv: "CSV",
};

const BY_NAME = {
  dockerfile: "Dockerfile",
  makefile: "Makefile",
  gemfile: "Ruby",
  rakefile: "Ruby",
  podfile: "Ruby",
  procfile: "Config",
  license: "Text",
  readme: "Markdown",
  ".gitignore": "Config",
  ".dockerignore": "Config",
  ".editorconfig": "Config",
  ".eslintrc": "JSON",
  ".prettierrc": "JSON",
  ".babelrc": "JSON",
  ".npmrc": "Config",
};

const DOC_LANGS = new Set(["Markdown", "reStructuredText", "Text"]);
const CONFIG_LANGS = new Set(["JSON", "YAML", "TOML", "XML", "Config", "Gradle", "Dockerfile", "Makefile", "Terraform", "Protocol Buffers"]);
const DATA_LANGS = new Set(["CSV"]);

export function detectLanguage(path) {
  const base = path.split("/").pop().toLowerCase();
  if (BY_NAME[base]) return BY_NAME[base];
  if (base.startsWith("dockerfile")) return "Dockerfile";
  if (base.startsWith("readme")) return "Markdown";
  if (base.startsWith(".env")) return "Config";
  const dot = base.lastIndexOf(".");
  if (dot > 0) return BY_EXT[base.slice(dot + 1)] || "Other";
  return "Other";
}

// Coarse category used for prioritising files and for the UI.
export function fileKind(language) {
  if (DOC_LANGS.has(language)) return "docs";
  if (CONFIG_LANGS.has(language)) return "config";
  if (DATA_LANGS.has(language)) return "data";
  if (language === "Other") return "other";
  return "source";
}
