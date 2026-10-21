import { parse as parseToml } from "smol-toml";
import { dirname } from "./resolvers.js";

// Parses dependency manifests into a common shape. Parsing only: nothing is installed or run.
// Manifest = { path, dir, ecosystem, name?, dependencies: [{name, version?, dev?}], meta: {...}, parseError? }

const base = (p) => p.split("/").pop();
const lowerBase = (p) => base(p).toLowerCase();

export function isManifestPath(path) {
  const b = lowerBase(path);
  return (
    ["package.json", "requirements.txt", "pyproject.toml", "pipfile", "pom.xml", "build.gradle", "build.gradle.kts", "cargo.toml", "go.mod", "composer.json", "gemfile", "pubspec.yaml", "package.swift"].includes(b) ||
    b.endsWith(".csproj") ||
    (/^requirements[-_.].*\.txt$/.test(b))
  );
}

const norm = (s) => String(s).trim().toLowerCase().replace(/[_.]+/g, "-");

function parsePackageJson(file) {
  const j = JSON.parse(file.content);
  const deps = [];
  for (const [field, dev] of [["dependencies", false], ["devDependencies", true], ["peerDependencies", false], ["optionalDependencies", false]]) {
    for (const [name, version] of Object.entries(j[field] ?? {})) deps.push({ name, version: String(version), dev });
  }
  return {
    ecosystem: "npm",
    name: typeof j.name === "string" ? j.name : undefined,
    dependencies: deps,
    meta: {
      main: typeof j.main === "string" ? j.main : undefined,
      module: typeof j.module === "string" ? j.module : undefined,
      bin: typeof j.bin === "string" ? { [j.name ?? "bin"]: j.bin } : j.bin && typeof j.bin === "object" ? j.bin : undefined,
      scripts: j.scripts && typeof j.scripts === "object" ? j.scripts : {},
      nodeEngine: j.engines?.node,
      type: j.type,
      workspaces: Array.isArray(j.workspaces) ? j.workspaces : j.workspaces?.packages,
      private: j.private,
    },
  };
}

function parseRequirements(file) {
  const deps = [];
  for (const raw of file.content.split("\n")) {
    const line = raw.split("#")[0].trim();
    if (!line || line.startsWith("-") || line.startsWith("git+") || /^https?:/.test(line)) continue;
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*(.*)$/.exec(line);
    if (m) deps.push({ name: norm(m[1]), version: m[2].split(";")[0].trim() || undefined });
  }
  return { ecosystem: "pypi", dependencies: deps, meta: {} };
}

function pep508Name(s) {
  const m = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(s);
  return m ? norm(m[1]) : null;
}

function parsePyproject(file) {
  const t = parseToml(file.content);
  const deps = [];
  const add = (name, version, dev) => name && name !== "python" && deps.push({ name: norm(name), version, dev });
  for (const d of t.project?.dependencies ?? []) add(pep508Name(d), undefined, false);
  for (const group of Object.values(t.project?.["optional-dependencies"] ?? {})) for (const d of group) add(pep508Name(d), undefined, true);
  for (const [n, v] of Object.entries(t.tool?.poetry?.dependencies ?? {})) add(n, typeof v === "string" ? v : v?.version, false);
  for (const [n, v] of Object.entries(t.tool?.poetry?.["dev-dependencies"] ?? {})) add(n, typeof v === "string" ? v : v?.version, true);
  for (const g of Object.values(t.tool?.poetry?.group ?? {})) for (const [n, v] of Object.entries(g.dependencies ?? {})) add(n, typeof v === "string" ? v : v?.version, true);
  for (const d of t["dependency-groups"] ? Object.values(t["dependency-groups"]).flat() : []) if (typeof d === "string") add(pep508Name(d), undefined, true);
  return { ecosystem: "pypi", name: t.project?.name ?? t.tool?.poetry?.name, dependencies: deps, meta: { scripts: t.project?.scripts ?? t.tool?.poetry?.scripts } };
}

function parsePipfile(file) {
  const t = parseToml(file.content);
  const deps = [];
  for (const n of Object.keys(t.packages ?? {})) deps.push({ name: norm(n), dev: false });
  for (const n of Object.keys(t["dev-packages"] ?? {})) deps.push({ name: norm(n), dev: true });
  return { ecosystem: "pypi", dependencies: deps, meta: {} };
}

function parsePom(file) {
  const deps = [];
  const stripped = file.content.replace(/<!--[\s\S]*?-->/g, "");
  const noMgmt = stripped.replace(/<dependencyManagement>[\s\S]*?<\/dependencyManagement>/g, "");
  for (const m of noMgmt.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const g = /<groupId>\s*([^<\s]+)\s*<\/groupId>/.exec(m[1])?.[1];
    const a = /<artifactId>\s*([^<\s]+)\s*<\/artifactId>/.exec(m[1])?.[1];
    const scope = /<scope>\s*([^<\s]+)\s*<\/scope>/.exec(m[1])?.[1];
    if (g && a) deps.push({ name: `${g}:${a}`, dev: scope === "test" });
  }
  const parentArtifact = /<parent>[\s\S]*?<artifactId>\s*([^<\s]+)\s*<\/artifactId>[\s\S]*?<\/parent>/.exec(stripped)?.[1];
  const withoutParent = stripped.replace(/<parent>[\s\S]*?<\/parent>/, "");
  return { ecosystem: "maven", name: /<artifactId>\s*([^<\s]+)\s*<\/artifactId>/.exec(withoutParent)?.[1], dependencies: deps, meta: { parent: parentArtifact } };
}

function parseGradle(file) {
  const deps = [];
  const text = file.content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of text.matchAll(/\b(implementation|api|compileOnly|runtimeOnly|annotationProcessor|kapt|ksp|testImplementation|androidTestImplementation|classpath)\s*\(?\s*["']([^"':]+:[^"':]+)(?::[^"']*)?["']/g)) {
    deps.push({ name: m[2], dev: /test/i.test(m[1]) });
  }
  const plugins = [...text.matchAll(/\bid\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
  for (const m of text.matchAll(/apply\s+plugin\s*:\s*["']([^"']+)["']/g)) plugins.push(m[1]);
  return { ecosystem: "gradle", dependencies: deps, meta: { plugins } };
}

function parseCargo(file) {
  const t = parseToml(file.content);
  const deps = [];
  for (const [section, dev] of [["dependencies", false], ["dev-dependencies", true], ["build-dependencies", true]]) for (const n of Object.keys(t[section] ?? {})) deps.push({ name: n, dev });
  for (const target of Object.values(t.target ?? {})) for (const n of Object.keys(target.dependencies ?? {})) deps.push({ name: n, dev: false });
  for (const n of Object.keys(t.workspace?.dependencies ?? {})) deps.push({ name: n, dev: false });
  return { ecosystem: "cargo", name: t.package?.name, dependencies: deps, meta: { workspace: t.workspace?.members } };
}

function parseGoMod(file) {
  const deps = [];
  const text = file.content.replace(/\/\/.*$/gm, "");
  const module = /^\s*module\s+(\S+)/m.exec(text)?.[1];
  for (const block of text.matchAll(/^\s*require\s*\(([\s\S]*?)^\s*\)/gm)) for (const l of block[1].split("\n")) {
    const m = /^\s*(\S+)\s+(v\S+)/.exec(l);
    if (m) deps.push({ name: m[1], version: m[2] });
  }
  for (const m of text.matchAll(/^\s*require\s+(\S+)\s+(v\S+)/gm)) deps.push({ name: m[1], version: m[2] });
  return { ecosystem: "go", name: module, dependencies: deps, meta: { module } };
}

function parseComposer(file) {
  const j = JSON.parse(file.content);
  const deps = [];
  for (const [n, v] of Object.entries(j.require ?? {})) if (n !== "php" && !n.startsWith("ext-")) deps.push({ name: n, version: String(v), dev: false });
  for (const [n, v] of Object.entries(j["require-dev"] ?? {})) deps.push({ name: n, version: String(v), dev: true });
  return { ecosystem: "composer", name: j.name, dependencies: deps, meta: {} };
}

function parseGemfile(file) {
  const deps = [];
  for (const m of file.content.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)) deps.push({ name: m[1] });
  return { ecosystem: "gem", dependencies: deps, meta: {} };
}

function parsePubspec(file) {
  const deps = [];
  let section = null;
  let name;
  let sdkFlutter = false;
  for (const raw of file.content.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const top = /^(\w[\w_]*):\s*(.*)$/.exec(line);
    if (top) {
      section = top[1];
      if (section === "name") name = top[2].trim();
      continue;
    }
    const child = /^ {2}([\w.-]+):\s*(.*)$/.exec(line);
    if (child && ["dependencies", "dev_dependencies"].includes(section)) {
      deps.push({ name: child[1], version: child[2] || undefined, dev: section === "dev_dependencies" });
      if (child[1] === "flutter") sdkFlutter = true;
    }
    if (/^\s+sdk:\s*flutter/.test(line)) sdkFlutter = true;
  }
  return { ecosystem: "pub", name, dependencies: deps, meta: { flutter: sdkFlutter } };
}

function parseCsproj(file) {
  const deps = [...file.content.matchAll(/<PackageReference\s+Include="([^"]+)"/g)].map((m) => ({ name: m[1] }));
  const sdk = /<Project\s+Sdk="([^"]+)"/.exec(file.content)?.[1];
  const target = /<TargetFramework[s]?>([^<]+)</.exec(file.content)?.[1];
  return { ecosystem: "nuget", name: base(file.path).replace(/\.csproj$/i, ""), dependencies: deps, meta: { sdk, target } };
}

function parseSwiftPackage(file) {
  const deps = [...file.content.matchAll(/\.package\s*\(\s*url:\s*"([^"]+)"/g)].map((m) => ({ name: m[1].replace(/\.git$/, "").split("/").slice(-2).join("/") }));
  return { ecosystem: "swiftpm", name: /name:\s*"([^"]+)"/.exec(file.content)?.[1], dependencies: deps, meta: {} };
}

export function parseManifest(file) {
  const b = lowerBase(file.path);
  const result = { path: file.path, dir: dirname(file.path), ecosystem: null, dependencies: [], meta: {} };
  try {
    let parsed;
    if (b === "package.json") parsed = parsePackageJson(file);
    else if (b === "requirements.txt" || /^requirements[-_.].*\.txt$/.test(b)) parsed = parseRequirements(file);
    else if (b === "pyproject.toml") parsed = parsePyproject(file);
    else if (b === "pipfile") parsed = parsePipfile(file);
    else if (b === "pom.xml") parsed = parsePom(file);
    else if (b === "build.gradle" || b === "build.gradle.kts") parsed = parseGradle(file);
    else if (b === "cargo.toml") parsed = parseCargo(file);
    else if (b === "go.mod") parsed = parseGoMod(file);
    else if (b === "composer.json") parsed = parseComposer(file);
    else if (b === "gemfile") parsed = parseGemfile(file);
    else if (b === "pubspec.yaml") parsed = parsePubspec(file);
    else if (b.endsWith(".csproj")) parsed = parseCsproj(file);
    else if (b === "package.swift") parsed = parseSwiftPackage(file);
    else return null;
    return { ...result, ...parsed };
  } catch (err) {
    return { ...result, ecosystem: ecosystemOf(b), parseError: String(err.message).slice(0, 160) };
  }
}

function ecosystemOf(b) {
  if (b === "package.json") return "npm";
  if (b.startsWith("requirements") || b === "pyproject.toml" || b === "pipfile") return "pypi";
  if (b === "pom.xml") return "maven";
  if (b.startsWith("build.gradle")) return "gradle";
  if (b === "cargo.toml") return "cargo";
  if (b === "go.mod") return "go";
  if (b === "composer.json") return "composer";
  if (b === "gemfile") return "gem";
  if (b === "pubspec.yaml") return "pub";
  if (b.endsWith(".csproj")) return "nuget";
  return null;
}

// tsconfig/jsconfig: strip comments and trailing commas, then read compilerOptions.paths.
export function parseTsconfigAliases(file) {
  try {
    const text = file.content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1").replace(/,(\s*[}\]])/g, "$1");
    const co = JSON.parse(text).compilerOptions ?? {};
    const dir = dirname(file.path);
    const baseUrl = co.baseUrl ? (dir ? `${dir}/${co.baseUrl}` : co.baseUrl).replace(/\/\.$/, "").replace(/^\.\//, "").replace(/\/\.\//g, "/") : dir;
    const aliases = [];
    for (const [pattern, targets] of Object.entries(co.paths ?? {})) {
      if (!Array.isArray(targets)) continue;
      const star = pattern.indexOf("*");
      const prefix = star === -1 ? pattern : pattern.slice(0, star);
      const suffix = star === -1 ? "" : pattern.slice(star + 1);
      aliases.push({
        scoped: (from) => (dir ? from.startsWith(dir + "/") : true),
        match: (spec) => (star === -1 ? (spec === pattern ? "" : null) : spec.startsWith(prefix) && spec.endsWith(suffix) && spec.length >= prefix.length + suffix.length ? spec.slice(prefix.length, spec.length - suffix.length) : null),
        targets: targets.map((t) => [baseUrl === "." ? "" : baseUrl, t.replace(/^\.\//, "")].filter(Boolean).join("/")),
      });
    }
    return aliases;
  } catch {
    return [];
  }
}
