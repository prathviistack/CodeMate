// Decides, from the path and size alone, whether a repository file is worth reading.
// Returns a skip reason string, or null when the file should be read.

const IGNORED_DIRS = new Set([
  "node_modules", "bower_components", ".git", ".hg", ".svn",
  "dist", "build", "out", "target", "obj", ".next", ".nuxt", ".svelte-kit", ".output",
  ".cache", ".parcel-cache", ".turbo", "coverage", ".nyc_output",
  "__pycache__", ".pytest_cache", ".mypy_cache", ".tox", ".venv", "venv", "site-packages",
  ".gradle", ".idea", ".vscode", "pods", "carthage", "deriveddata",
  "vendor", ".terraform", ".dart_tool", ".pub-cache", "__macosx",
]);

const GENERATED_FILES = new Set([
  "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  "poetry.lock", "pipfile.lock", "composer.lock", "cargo.lock", "gemfile.lock", "go.sum",
  "gradle.lockfile", "pubspec.lock", "podfile.lock", ".ds_store", "thumbs.db",
]);

const BINARY_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "svg", "tif", "tiff", "psd", "heic", "avif",
  "mp3", "mp4", "mov", "avi", "wav", "ogg", "webm", "flac", "mkv", "m4a",
  "pdf", "zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "jar", "war", "ear", "apk", "aab", "ipa", "dmg", "iso",
  "exe", "dll", "so", "dylib", "a", "o", "obj", "lib", "class", "pyc", "pyo", "wasm", "bin", "dat",
  "ttf", "otf", "woff", "woff2", "eot",
  "db", "sqlite", "sqlite3", "mdb",
  "pkl", "pickle", "npy", "npz", "h5", "hdf5", "onnx", "pt", "pth", "ckpt", "safetensors", "tflite", "pb", "parquet", "feather",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt",
]);

const KEY_EXT = new Set(["pem", "key", "p12", "pfx", "jks", "keystore", "ppk", "p8", "tfvars"]);
const SENSITIVE_NAMES = new Set([
  "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", ".npmrc", ".pypirc", ".netrc", ".htpasswd",
  "credentials", "credentials.json", "secrets.json", "secrets.yml", "secrets.yaml",
  "terraform.tfstate", "terraform.tfstate.backup", "service-account.json", "serviceaccount.json",
]);
const ENV_TEMPLATE_SUFFIXES = new Set(["example", "sample", "template", "dist", "defaults", "default"]);

export function classifyPath(path, size, limits) {
  const segments = path.split("/");
  const base = segments[segments.length - 1];
  const lower = base.toLowerCase();

  for (let i = 0; i < segments.length - 1; i++) {
    if (IGNORED_DIRS.has(segments[i].toLowerCase())) return "ignored_dir";
  }

  // Secrets and credentials are never read at all.
  if (lower === ".env") return "sensitive_file";
  if (lower.startsWith(".env.") && !ENV_TEMPLATE_SUFFIXES.has(lower.split(".").pop())) return "sensitive_file";
  if (SENSITIVE_NAMES.has(lower) || /^service[-_]?account.*\.json$/.test(lower)) return "sensitive_file";
  const ext = lower.includes(".") ? lower.split(".").pop() : "";
  if (KEY_EXT.has(ext)) return "sensitive_file";

  if (GENERATED_FILES.has(lower)) return "generated";
  if (/\.min\.(js|css)$/.test(lower) || /-min\.(js|css)$/.test(lower) || ext === "map") return "minified";
  if (BINARY_EXT.has(ext)) return "binary";
  if (size === 0) return "empty";

  const cap = ext === "ipynb" ? limits.maxNotebookBytes : limits.maxFileBytes;
  if (size > cap) return "too_large";
  return null;
}

const MANIFESTS = new Set([
  "package.json", "requirements.txt", "pyproject.toml", "setup.py", "pipfile", "pom.xml", "build.gradle", "build.gradle.kts",
  "settings.gradle", "cargo.toml", "go.mod", "composer.json", "gemfile", "pubspec.yaml", "dockerfile",
  "docker-compose.yml", "docker-compose.yaml", "tsconfig.json", "androidmanifest.xml", "package.swift", "podfile",
]);

// Lower number = more important to keep when a repository is larger than our storage limits.
export function pathPriority(path, kind) {
  const lower = path.toLowerCase();
  const base = lower.split("/").pop();
  if (base.startsWith("readme") || MANIFESTS.has(base) || base.endsWith(".csproj")) return 0;
  if (/(^|\/)(tests?|__tests__|spec|specs|e2e|fixtures?|examples?|samples?|docs?)\//.test(lower) || /\.(test|spec)\.|_test\./.test(base)) return 3;
  if (kind === "data" || kind === "other") return 3;
  if (kind === "docs") return 2;
  if (kind === "config") return 2;
  return 1;
}
