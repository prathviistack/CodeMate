import { CATALOG, FILE_EVIDENCE, ROLE_OF_TYPE, depMatches } from "./catalog.js";
import { PY_IMPORT_TO_DIST } from "./resolvers.js";

// Evidence-based technology detection. Every detection carries the evidence that justified it.

const LANG_ECOSYSTEMS = {
  JavaScript: ["npm"], TypeScript: ["npm"], Vue: ["npm"], Svelte: ["npm"],
  Python: ["pypi"], "Jupyter Notebook": ["pypi"],
  Rust: ["cargo"], Go: ["go"], Dart: ["pub"], PHP: ["composer"], Ruby: ["gem"],
  Java: ["maven", "gradle"], Kotlin: ["gradle", "maven"], "C#": ["nuget"],
};

// JVM source imports do not equal dependency names, so map package prefixes to catalog entries.
const JVM_IMPORT_HINTS = {
  "Spring Boot": ["org.springframework"],
  "Spring Web MVC": ["org.springframework.web"],
  "Spring Data JPA": ["jakarta.persistence", "javax.persistence", "org.hibernate"],
  JUnit: ["org.junit", "junit.framework"],
  "Android app": ["android.", "androidx."],
  "Jetpack Compose": ["androidx.compose"],
};

const MAX_EVIDENCE = 6;
const CONF_RANK = { low: 0, medium: 1, high: 2 };

const normDist = (s) => s.toLowerCase().replace(/[_.]+/g, "-");

/** Names of external packages imported by a component's files, with sample files. */
function collectImports(componentFiles) {
  const byEco = { npm: new Map(), pypi: new Map(), other: new Map(), jvm: new Map() };
  const add = (map, name, path) => {
    const e = map.get(name) ?? { files: new Set() };
    e.files.add(path);
    map.set(name, e);
  };
  for (const f of componentFiles) {
    for (const imp of f.imports) {
      if (imp.target || imp.targets || !imp.external || imp.builtin) continue;
      if (f.analyzer === "js-ast") add(byEco.npm, imp.external.toLowerCase(), f.path);
      else if (f.analyzer === "python-pattern") add(byEco.pypi, normDist(PY_IMPORT_TO_DIST[imp.external] ?? imp.external), f.path);
      else add(byEco.other, imp.external.toLowerCase().replace(/-/g, "_"), f.path);
    }
    if (f.language === "Java" || f.language === "Kotlin") for (const imp of f.imports) add(byEco.jvm, imp.spec, f.path);
  }
  return byEco;
}

function evidenceKinds(ev) {
  return new Set(ev.map((e) => e.kind)).size;
}

export function detectComponentTechnologies(component, manifests, componentFiles, allPaths) {
  const found = new Map(); // name -> { name, type, evidence[] }
  const ensure = (entry) => {
    if (!found.has(entry.name)) found.set(entry.name, { name: entry.name, type: entry.type, evidence: [] });
    return found.get(entry.name);
  };
  const push = (entry, ev) => {
    const tech = ensure(entry);
    if (tech.evidence.length < MAX_EVIDENCE && !tech.evidence.some((e) => e.kind === ev.kind && e.detail === ev.detail)) tech.evidence.push(ev);
  };

  const imports = collectImports(componentFiles);
  const ecosystems = new Set(manifests.map((m) => m.ecosystem).filter(Boolean));
  for (const f of componentFiles) for (const e of LANG_ECOSYSTEMS[f.language] ?? []) ecosystems.add(e);

  for (const eco of ecosystems) {
    for (const entry of CATALOG[eco] ?? []) {
      // 1. manifest evidence
      for (const m of manifests.filter((x) => x.ecosystem === eco)) {
        for (const dep of m.dependencies) {
          if (entry.deps.some((p) => depMatches(p, dep.name))) push(entry, { kind: "dependency", detail: `${dep.name}${dep.version ? " " + dep.version : ""} in ${m.path.split("/").pop()}`, path: m.path });
        }
        if (entry.plugins?.some((p) => m.meta.plugins?.includes(p))) push(entry, { kind: "dependency", detail: `plugin ${entry.plugins.find((p) => m.meta.plugins.includes(p))} in ${m.path.split("/").pop()}`, path: m.path });
        if (entry.flag && m.meta[entry.flag]) push(entry, { kind: "dependency", detail: `${entry.flag} SDK in ${m.path.split("/").pop()}`, path: m.path });
        if (entry.sdk && m.meta.sdk === entry.sdk) push(entry, { kind: "dependency", detail: `Sdk="${entry.sdk}" in ${m.path.split("/").pop()}`, path: m.path });
      }
      // 2. source imports
      const map = eco === "npm" ? imports.npm : eco === "pypi" ? imports.pypi : imports.other;
      for (const dep of entry.deps) {
        if (dep.endsWith("*")) continue;
        const key = eco === "pypi" ? normDist(dep) : eco === "cargo" || eco === "pub" ? dep.toLowerCase().replace(/-/g, "_") : dep.toLowerCase();
        const hit = map.get(key);
        if (hit) push(entry, { kind: "import", detail: `imported in ${hit.files.size} file${hit.files.size > 1 ? "s" : ""} (e.g. ${[...hit.files][0]})`, path: [...hit.files][0] });
      }
      if (eco === "go") for (const dep of entry.deps) {
        const hit = [...imports.other.entries()].find(([k]) => k.startsWith(dep.toLowerCase().replace(/\*$/, "").replace(/-/g, "_")));
        if (hit) push(entry, { kind: "import", detail: `imported in ${hit[1].files.size} file(s) (e.g. ${[...hit[1].files][0]})`, path: [...hit[1].files][0] });
      }
      if ((eco === "maven" || eco === "gradle") && JVM_IMPORT_HINTS[entry.name]) {
        for (const prefix of JVM_IMPORT_HINTS[entry.name]) {
          const hit = [...imports.jvm.entries()].find(([k]) => k.startsWith(prefix));
          if (hit) {
            push(entry, { kind: "import", detail: `source imports ${prefix}* (e.g. ${[...hit[1].files][0]})`, path: [...hit[1].files][0] });
            break;
          }
        }
      }
      // 3. characteristic config files
      for (const re of entry.files ?? []) {
        const p = allPaths.find((x) => re.test(x) && (component.root === "" || x.startsWith(component.root + "/")));
        if (p) push(entry, { kind: "config-file", detail: p.split("/").pop(), path: p });
      }
    }
  }

  // Config-file evidence that is not tied to a catalog dependency.
  for (const fe of FILE_EVIDENCE) {
    const p = allPaths.find((x) => fe.re.test(x) && (component.root === "" || x.startsWith(component.root + "/")));
    if (!p) continue;
    if (fe.needsContent) {
      const f = componentFiles.find((x) => x.path === p);
      if (!f?.content || !fe.needsContent.test(f.content)) continue;
    }
    push({ name: fe.name, type: fe.type }, { kind: "config-file", detail: p.split("/").pop(), path: p });
  }

  // Source annotations that identify a framework without a manifest entry (e.g. Spring).
  for (const f of componentFiles) {
    if (f.mainReason?.includes("@SpringBootApplication")) push({ name: "Spring Boot", type: "backend-framework" }, { kind: "source-pattern", detail: "@SpringBootApplication annotation", path: f.path });
  }
  const pyApp = componentFiles.find((f) => f.appCreation);
  if (pyApp) {
    const fw = pyApp.appCreation;
    const entry = (CATALOG.pypi.find((c) => c.name.toLowerCase() === fw.toLowerCase())) ?? null;
    if (entry) push(entry, { kind: "source-pattern", detail: `${fw}(...) application object created`, path: pyApp.path });
  }

  // Node.js runtime: only when the manifest or scripts show server-side Node usage.
  for (const m of manifests.filter((x) => x.ecosystem === "npm")) {
    const scripts = Object.values(m.meta.scripts ?? {}).join(" ");
    const serverTech = [...found.values()].some((t) => t.type === "backend-framework" || t.type === "fullstack-framework");
    if (m.meta.nodeEngine) push({ name: "Node.js", type: "runtime" }, { kind: "dependency", detail: `engines.node ${m.meta.nodeEngine} in package.json`, path: m.path });
    else if (/\b(node|nodemon|ts-node|tsx)\s/.test(scripts)) push({ name: "Node.js", type: "runtime" }, { kind: "dependency", detail: "scripts run node in package.json", path: m.path });
    else if (serverTech) push({ name: "Node.js", type: "runtime" }, { kind: "dependency", detail: "server-side npm package present", path: m.path });
  }

  return [...found.values()].map((t) => ({
    ...t,
    confidence: evidenceKinds(t.evidence) >= 2 ? "high" : "medium",
  }));
}

export function mergeTechnologies(perComponent) {
  const all = new Map();
  for (const { component, technologies } of perComponent) {
    for (const t of technologies) {
      const cur = all.get(t.name) ?? { name: t.name, type: t.type, confidence: "medium", evidence: [], components: [] };
      cur.components.push(component.root);
      for (const ev of t.evidence) if (cur.evidence.length < MAX_EVIDENCE && !cur.evidence.some((e) => e.detail === ev.detail && e.kind === ev.kind)) cur.evidence.push(ev);
      if (CONF_RANK[t.confidence] > CONF_RANK[cur.confidence]) cur.confidence = t.confidence;
      all.set(t.name, cur);
    }
  }
  return [...all.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

export function rolesFor(technologies, hasNotebooks) {
  const roles = new Set();
  for (const t of technologies) for (const r of ROLE_OF_TYPE[t.type] ?? []) roles.add(r);
  if (hasNotebooks) roles.add("ml");
  return [...roles];
}

// Named stack patterns, reported only when EVERY ingredient was detected.
const STACKS = [
  { name: "MERN-style stack", needs: [["MongoDB driver", "Mongoose"], ["Express"], ["React"]] },
  { name: "MEAN-style stack", needs: [["MongoDB driver", "Mongoose"], ["Express"], ["Angular"]] },
  { name: "MEVN-style stack", needs: [["MongoDB driver", "Mongoose"], ["Express"], ["Vue"]] },
];

export function detectStacks(technologies) {
  const names = new Set(technologies.map((t) => t.name));
  const out = [];
  for (const s of STACKS) {
    const matched = s.needs.map((alts) => alts.find((a) => names.has(a)));
    if (matched.every(Boolean)) out.push({ name: s.name, evidence: matched });
  }
  return out;
}
