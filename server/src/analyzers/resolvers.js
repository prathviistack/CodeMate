import { builtinModules } from "module";

// Resolves an import to a file stored in the repository, or marks it external.
//   verified: the import statement names a path that exists in the repository
//   inferred: resolved through a convention (package layout, aliases, path suffix)
// Results: { target, kind } | { external: "name" } | null (unresolved/unknown)

const JS_EXTS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".vue", ".svelte"];
const NODE_BUILTINS = new Set(builtinModules.filter((m) => !m.startsWith("_")));

const PY_STDLIB = new Set(
  ("abc argparse array ast asyncio atexit base64 bisect builtins bz2 calendar cmath collections concurrent configparser contextlib copy csv ctypes dataclasses datetime decimal difflib " +
    "email enum errno fcntl fnmatch fractions functools gc getpass glob gzip hashlib heapq hmac html http importlib inspect io ipaddress itertools json keyword logging lzma math mimetypes " +
    "multiprocessing numbers operator os pathlib pickle platform pprint queue random re secrets select shlex shutil signal smtplib socket sqlite3 ssl stat statistics string struct " +
    "subprocess sys tempfile textwrap threading time timeit tkinter traceback types typing unittest urllib uuid warnings weakref xml zipfile zlib zoneinfo __future__").split(" ")
);

export const dirname = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const join = (...parts) => parts.filter(Boolean).join("/");

function normalize(path) {
  const out = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (!out.length) return null;
      out.pop();
    } else out.push(seg);
  }
  return out.join("/");
}

export function externalPackageName(spec, ecosystem) {
  if (ecosystem === "npm") {
    if (spec.startsWith("node:")) return null;
    const parts = spec.split("/");
    return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  }
  return spec.split(".")[0];
}

function resolveJs(spec, from, ctx) {
  const tryPaths = (base) => {
    const cands = [base];
    for (const e of JS_EXTS) cands.push(base + e);
    for (const e of JS_EXTS) cands.push(`${base}/index${e}`);
    // ESM-style TypeScript imports: "./a.js" refers to a.ts / a.tsx
    if (/\.(m|c)?js$/.test(base)) {
      const stem = base.replace(/\.(m|c)?js$/, "");
      cands.push(stem + ".ts", stem + ".tsx");
    }
    return cands.find((c) => ctx.fileSet.has(c)) ?? null;
  };

  if (spec.startsWith(".")) {
    const base = normalize(join(dirname(from), spec));
    const hit = base === null ? null : tryPaths(base);
    return hit ? { target: hit, kind: "verified" } : null;
  }
  if (spec.startsWith("node:") || NODE_BUILTINS.has(spec.split("/")[0])) return { external: "node:builtin", builtin: true };

  // tsconfig/jsconfig path aliases (convention -> inferred)
  for (const alias of ctx.jsAliases ?? []) {
    if (!alias.scoped(from)) continue;
    const m = alias.match(spec);
    if (m !== null) {
      for (const targetBase of alias.targets) {
        const base = normalize(targetBase.replace("*", m));
        const hit = base === null ? null : tryPaths(base);
        if (hit) return { target: hit, kind: "inferred" };
      }
    }
  }
  return { external: externalPackageName(spec, "npm") };
}

function resolvePython(imp, from, ctx) {
  const spec = imp.spec;
  const tryModule = (baseDir, dotted) => {
    const rel = dotted.split(".").filter(Boolean).join("/");
    const cands = rel ? [join(baseDir, rel + ".py"), join(baseDir, rel, "__init__.py")] : [join(baseDir, "__init__.py")];
    return cands.find((c) => ctx.fileSet.has(c)) ?? null;
  };

  if (spec.startsWith(".")) {
    const dots = spec.match(/^\.+/)[0].length;
    let base = dirname(from);
    for (let i = 1; i < dots; i++) base = dirname(base);
    const rest = spec.slice(dots);
    const hit = tryModule(base, rest);
    if (hit) return { target: hit, kind: "verified" };
    // `from . import x` / `from .pkg import x`: x may itself be a module
    for (const name of imp.names ?? []) {
      const sub = tryModule(base, rest ? `${rest}.${name}` : name);
      if (sub) return { target: sub, kind: "verified" };
    }
    return null;
  }

  const root = spec.split(".")[0];
  if (PY_STDLIB.has(root)) return { external: root, builtin: true };

  // Absolute import: depends on sys.path, so a match is only ever "inferred".
  const bases = ["", ...(ctx.pythonRoots ?? [])];
  let d = dirname(from);
  while (d) {
    bases.push(d);
    d = dirname(d);
  }
  for (const b of bases) {
    const hit = tryModule(b, spec);
    if (hit) return { target: hit, kind: "inferred" };
    for (const name of imp.names ?? []) {
      const sub = tryModule(b, `${spec}.${name}`);
      if (sub) return { target: sub, kind: "inferred" };
    }
  }
  return { external: root };
}

function resolveGeneric(imp, file, ctx) {
  const { spec } = imp;
  const from = file.path;
  const exists = (p) => (p !== null && ctx.fileSet.has(p) ? p : null);

  switch (file.language) {
    case "C":
    case "C++":
    case "Objective-C": {
      if (imp.kind === "system-include") return { external: spec };
      const hit = exists(normalize(join(dirname(from), spec))) || exists(normalize(spec));
      return hit ? { target: hit, kind: "verified" } : { external: spec };
    }
    case "Ruby": {
      if (imp.kind === "require_relative") {
        const base = normalize(join(dirname(from), spec));
        const hit = exists(base + ".rb") || exists(base);
        return hit ? { target: hit, kind: "verified" } : null;
      }
      const hit = exists(`lib/${spec}.rb`) || exists(`${spec}.rb`);
      return hit ? { target: hit, kind: "inferred" } : { external: spec.split("/")[0] };
    }
    case "Dart": {
      if (spec.startsWith("dart:")) return { external: spec, builtin: true };
      if (spec.startsWith("package:")) {
        const [, pkg, ...rest] = /^package:([^/]+)\/(.*)$/.exec(spec) ?? [];
        if (pkg && pkg === ctx.dartPackage) {
          const hit = exists(join(ctx.dartRoot ?? "", "lib", rest.join("/")));
          return hit ? { target: hit, kind: "inferred" } : null;
        }
        return { external: pkg ?? spec };
      }
      const hit = exists(normalize(join(dirname(from), spec)));
      return hit ? { target: hit, kind: "verified" } : null;
    }
    case "Rust": {
      if (imp.kind === "mod") {
        const dir = dirname(from);
        const stem = from.split("/").pop().replace(/\.rs$/, "");
        const base = ["main", "lib", "mod"].includes(stem) ? dir : join(dir, stem);
        const hit = exists(join(base, spec + ".rs")) || exists(join(base, spec, "mod.rs"));
        return hit ? { target: hit, kind: "verified" } : null;
      }
      const root = spec.split("::")[0];
      if (["crate", "self", "super"].includes(root)) return null;
      return { external: root };
    }
    case "Go": {
      if (ctx.goModule && (spec === ctx.goModule || spec.startsWith(ctx.goModule + "/"))) {
        const dir = join(ctx.goRoot ?? "", spec.slice(ctx.goModule.length + 1));
        const files = (ctx.byDir.get(dir) ?? []).filter((p) => p.endsWith(".go") && !p.endsWith("_test.go")).sort();
        return files.length ? { targets: files.slice(0, 8), kind: "inferred", note: "package-level import" } : null;
      }
      return { external: spec.split("/").slice(0, 3).join("/"), builtin: !spec.includes(".") };
    }
    case "Java":
    case "Kotlin":
    case "Scala":
    case "Groovy": {
      if (imp.wildcard) return null;
      const rel = spec.replace(/\./g, "/");
      const exts = file.language === "Java" ? [".java"] : [".kt", ".java", ".scala", ".groovy"];
      for (const e of exts) {
        const hit = ctx.findBySuffix(rel + e);
        if (hit) return { target: hit, kind: "inferred" };
      }
      return { external: spec.split(".").slice(0, 2).join(".") };
    }
    case "PHP": {
      if (imp.kind === "require") {
        const hit = exists(normalize(join(dirname(from), spec)));
        return hit ? { target: hit, kind: "verified" } : null;
      }
      const rel = spec.replace(/\\/g, "/") + ".php";
      const hit = ctx.findBySuffix(rel) || ctx.findBySuffix(rel.split("/").slice(1).join("/"));
      return hit ? { target: hit, kind: "inferred" } : { external: spec.split("\\")[0] };
    }
    default:
      return null;
  }
}

/** Builds the lookup context shared by all resolvers. */
export function buildResolveContext(paths, extra = {}) {
  const fileSet = new Set(paths);
  const byDir = new Map();
  const byBase = new Map();
  for (const p of paths) {
    const d = dirname(p);
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push(p);
    const base = p.split("/").pop();
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(p);
  }
  const findBySuffix = (suffix) => {
    const base = suffix.split("/").pop();
    const cands = (byBase.get(base) ?? []).filter((p) => p === suffix || p.endsWith("/" + suffix));
    if (cands.length) return cands.sort((a, b) => a.length - b.length)[0];
    // PHP namespaces are often lower-cased directories (App\Models -> app/Models)
    const lower = suffix.toLowerCase();
    return (byBase.get(base) ?? []).find((p) => p.toLowerCase().endsWith("/" + lower) || p.toLowerCase() === lower) ?? null;
  };
  return { fileSet, byDir, byBase, findBySuffix, ...extra };
}

/** @returns {{target?: string, targets?: string[], kind?: string, external?: string, builtin?: boolean} | null} */
export function resolveImport(imp, file, analyzerId, ctx) {
  if (analyzerId === "js-ast") return resolveJs(imp.spec, file.path, ctx);
  if (analyzerId === "python-pattern") return resolvePython(imp, file.path, ctx);
  return resolveGeneric(imp, file, ctx);
}

/** Maps Python import roots to their PyPI distribution names for dependency matching. */
export const PY_IMPORT_TO_DIST = {
  sklearn: "scikit-learn", cv2: "opencv-python", PIL: "pillow", yaml: "pyyaml", bs4: "beautifulsoup4",
  dotenv: "python-dotenv", jwt: "pyjwt", dateutil: "python-dateutil", serial: "pyserial", flask_sqlalchemy: "flask-sqlalchemy",
  rest_framework: "djangorestframework", psycopg2: "psycopg2", google: "google", attr: "attrs", skimage: "scikit-image",
};
export { PY_STDLIB };
