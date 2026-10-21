// Python analyzer. PATTERN-BASED (line scanning), not a full parser: there is no Python
// parser available in Node, and we never run python on imported code. It is reliable for
// import statements, top-level def/class, and common web-framework decorators, and it is
// reported as "pattern" depth everywhere so users know its limits.

const MAX = { imports: 300, symbols: 300, routes: 100, models: 50 };

const IMPORT_RE = /^\s*import\s+(.+)$/;
const FROM_RE = /^\s*from\s+(\.*)([\w.]*)\s+import\s+(.+)$/;
const DEF_RE = /^(async\s+)?def\s+([A-Za-z_]\w*)/;
const CLASS_RE = /^class\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?/;
const ROUTE_DECORATOR_RE = /^\s*@(\w+)\.(route|get|post|put|patch|delete|head|options|websocket)\(\s*(["'])([^"']*)\3([^)]*)\)/;
const DJANGO_PATH_RE = /^\s*(?:re_)?path\(\s*r?(["'])([^"']*)\1\s*,\s*([\w.]+)/;
const APP_CREATE_RE = /^([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(Flask|FastAPI|Starlette|Sanic|Quart|Bottle|Flask_RESTful)\s*\(/;

// Triple-quoted strings (docstrings) can contain text that looks like code.
function stripDocstringState(line, inDoc) {
  let state = inDoc;
  const re = /("""|''')/g;
  let m;
  let count = 0;
  while ((m = re.exec(line))) {
    if (state === null) state = m[1];
    else if (state === m[1]) state = null;
    count++;
  }
  return { state, startsOrEndsInside: count > 0 };
}

export const pythonAnalyzer = {
  id: "python-pattern",
  name: "Python (pattern-based)",
  depth: "pattern",
  languages: ["Python", "Jupyter Notebook"],
  analyze(file) {
    const imports = [];
    const symbols = [];
    const routes = [];
    const models = [];
    const appCreations = [];
    let hasMain = false;
    let doc = null;

    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const wasInDoc = doc !== null;
      const { state, startsOrEndsInside } = stripDocstringState(line, doc);
      doc = state;
      if (wasInDoc || startsOrEndsInside) continue; // skip docstring lines entirely
      if (/^\s*#/.test(line)) continue;
      const n = i + 1;

      if (/^if\s+__name__\s*==\s*["']__main__["']/.test(line)) {
        hasMain = true;
        continue;
      }

      let m = FROM_RE.exec(line);
      if (m) {
        const names = m[3].replace(/[()]/g, "").split("#")[0].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter((s) => /^\w+$/.test(s));
        if (imports.length < MAX.imports) imports.push({ spec: m[1] + m[2], line: n, kind: m[1] ? "relative-from" : "from", names });
        continue;
      }
      m = IMPORT_RE.exec(line);
      if (m && !/^\s*import\s*$/.test(line)) {
        for (const part of m[1].split("#")[0].split(",")) {
          const mod = part.trim().split(/\s+as\s+/)[0];
          if (/^[\w.]+$/.test(mod) && imports.length < MAX.imports) imports.push({ spec: mod, line: n, kind: "import" });
        }
        continue;
      }

      m = DEF_RE.exec(line);
      if (m) {
        if (symbols.length < MAX.symbols) symbols.push({ name: m[2], kind: "function", line: n, exported: !m[2].startsWith("_") });
        continue;
      }
      m = CLASS_RE.exec(line);
      if (m) {
        if (symbols.length < MAX.symbols) symbols.push({ name: m[1], kind: "class", line: n, exported: !m[1].startsWith("_") });
        const bases = m[2] || "";
        if (models.length < MAX.models) {
          if (/\bmodels\.Model\b/.test(bases)) models.push({ name: m[1], kind: "django", line: n, basis: "subclass of models.Model" });
          else if (/\b(db\.Model|Base|DeclarativeBase|SQLModel)\b/.test(bases) && /sqlalchemy|SQLModel|db\.Model|Base/.test(file.content)) models.push({ name: m[1], kind: "sqlalchemy", line: n, basis: `subclass of ${bases.trim()}` });
        }
        continue;
      }

      m = ROUTE_DECORATOR_RE.exec(line);
      if (m && routes.length < MAX.routes) {
        let method = m[2] === "route" ? "ANY" : m[2].toUpperCase();
        if (m[2] === "route") {
          const mm = /methods\s*=\s*\[([^\]]*)\]/.exec(m[5]);
          if (mm) method = mm[1].replace(/["'\s]/g, "").toUpperCase().replace(/,/g, "|");
        }
        // The next def is the handler.
        let handler = null;
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const d = DEF_RE.exec(lines[j].trim());
          if (d) {
            handler = d[2];
            break;
          }
        }
        routes.push({ method, path: m[4], handler, line: n, basis: "decorator-pattern" });
        continue;
      }
      m = DJANGO_PATH_RE.exec(line);
      if (m && /urls?\.py$/.test(file.path) && routes.length < MAX.routes) {
        routes.push({ method: "ANY", path: m[2], handler: m[3], line: n, basis: "django-urlpattern" });
        continue;
      }
      m = APP_CREATE_RE.exec(line);
      if (m) appCreations.push({ variable: m[1], framework: m[2], line: n });
    }

    const facts = { imports, symbols, routes, apiCalls: [], models, appCreations };
    if (appCreations.length) {
      facts.hasMain = true;
      facts.mainReason = `creates a ${appCreations[0].framework} application object`;
    } else if (hasMain) {
      facts.hasMain = true;
      facts.mainReason = 'has an `if __name__ == "__main__"` block';
    } else if (/(^|\/)manage\.py$/.test(file.path) && /django/i.test(file.content)) {
      facts.hasMain = true;
      facts.mainReason = "is Django's management script";
    }
    return facts;
  },
};
