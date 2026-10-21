// Generic fallback analyzer for languages without a dedicated parser. PATTERN-BASED:
// it finds import statements, a few declaration forms and obvious entry points by regex.
// It does not understand the language's semantics and never claims to.

const MAX = { imports: 300, symbols: 200 };

// language -> { imports: [{re, group, kind}], symbols: [{re, kind}], main: [{re, reason}] }
const RULES = {
  Java: {
    imports: [{ re: /^\s*import\s+(?:static\s+)?([\w.]+)(\.\*)?\s*;/, kind: "import" }],
    symbols: [{ re: /^\s*(?:public\s+|protected\s+|private\s+|abstract\s+|final\s+|static\s+)*(class|interface|enum|record)\s+(\w+)/, kind: 1 }],
    main: [
      { re: /public\s+static\s+void\s+main\s*\(/, reason: "declares a main method" },
      { re: /@SpringBootApplication/, reason: "is annotated @SpringBootApplication" },
    ],
  },
  Kotlin: {
    imports: [{ re: /^\s*import\s+([\w.]+)(\.\*)?\s*$/, kind: "import" }],
    symbols: [{ re: /^\s*(?:data\s+|sealed\s+|abstract\s+|open\s+|enum\s+|internal\s+|private\s+)*(class|interface|object)\s+(\w+)/, kind: 1 }],
    main: [
      { re: /^\s*fun\s+main\s*\(/m, reason: "declares a main function" },
      { re: /@SpringBootApplication/, reason: "is annotated @SpringBootApplication" },
    ],
  },
  Scala: { imports: [{ re: /^\s*import\s+([\w.]+)/, kind: "import" }], symbols: [{ re: /^\s*(?:case\s+|sealed\s+|abstract\s+)*(class|object|trait)\s+(\w+)/, kind: 1 }], main: [{ re: /def\s+main\s*\(/, reason: "declares a main method" }] },
  Go: {
    imports: [],
    symbols: [
      { re: /^func\s+(?:\([^)]*\)\s*)?(\w+)\s*\(/, kind: "function", nameGroup: 1 },
      { re: /^type\s+(\w+)\s+(struct|interface)/, kind: 2, nameGroup: 1 },
    ],
    main: [],
  },
  Rust: {
    imports: [
      { re: /^\s*(?:pub\s+)?use\s+([\w:]+)/, kind: "use" },
      { re: /^\s*(?:pub\s+)?mod\s+(\w+)\s*;/, kind: "mod" },
    ],
    symbols: [
      { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?(struct|enum|trait)\s+(\w+)/, kind: 1 },
      { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+(\w+)/, kind: "function", nameGroup: 1 },
    ],
    main: [{ re: /^\s*(?:async\s+)?fn\s+main\s*\(/m, reason: "declares fn main" }],
  },
  C: { imports: [{ re: /^\s*#\s*include\s*"([^"]+)"/, kind: "include" }, { re: /^\s*#\s*include\s*<([^>]+)>/, kind: "system-include" }], symbols: [], main: [{ re: /^\s*(?:int|void)\s+main\s*\(/m, reason: "defines main()" }] },
  "C++": { imports: [{ re: /^\s*#\s*include\s*"([^"]+)"/, kind: "include" }, { re: /^\s*#\s*include\s*<([^>]+)>/, kind: "system-include" }], symbols: [{ re: /^\s*(?:template\s*<[^>]*>\s*)?(class|struct)\s+(\w+)/, kind: 1 }], main: [{ re: /^\s*(?:int|void)\s+main\s*\(/m, reason: "defines main()" }] },
  "C#": {
    imports: [{ re: /^\s*(?:global\s+)?using\s+(?:static\s+)?([\w.]+)\s*;/, kind: "using" }],
    symbols: [{ re: /^\s*(?:public\s+|internal\s+|private\s+|protected\s+|static\s+|abstract\s+|sealed\s+|partial\s+)*(class|interface|struct|enum|record)\s+(\w+)/, kind: 1 }],
    main: [{ re: /static\s+(?:async\s+)?(?:void|int|Task)\s+Main\s*\(/, reason: "declares a Main method" }],
  },
  PHP: {
    imports: [{ re: /^\s*use\s+([\w\\]+)(?:\s+as\s+\w+)?\s*;/, kind: "use" }, { re: /^\s*(?:require|include)(?:_once)?\s*\(?\s*['"]([^'"]+)['"]/, kind: "require" }],
    symbols: [{ re: /^\s*(?:abstract\s+|final\s+)?(class|interface|trait)\s+(\w+)/, kind: 1 }],
    main: [],
  },
  Ruby: {
    imports: [{ re: /^\s*require_relative\s+['"]([^'"]+)['"]/, kind: "require_relative" }, { re: /^\s*require\s+['"]([^'"]+)['"]/, kind: "require" }],
    symbols: [{ re: /^\s*(class|module)\s+([A-Z]\w*)/, kind: 1 }],
    main: [],
  },
  Dart: {
    imports: [{ re: /^\s*(?:import|export)\s+['"]([^'"]+)['"]/, kind: "import" }],
    symbols: [{ re: /^\s*(?:abstract\s+)?(class|mixin|enum|extension)\s+(\w+)/, kind: 1 }],
    main: [{ re: /^\s*(?:Future<void>\s+|void\s+)main\s*\(/m, reason: "declares main()" }],
  },
  Swift: {
    imports: [{ re: /^\s*import\s+(?:class\s+|struct\s+|func\s+)?([\w.]+)/, kind: "import" }],
    symbols: [{ re: /^\s*(?:public\s+|open\s+|final\s+|private\s+|internal\s+)*(class|struct|enum|protocol|actor)\s+(\w+)/, kind: 1 }],
    main: [
      { re: /^\s*@main\b/m, reason: "is marked @main" },
      { re: /@UIApplicationMain|@NSApplicationMain/, reason: "is the application delegate entry" },
    ],
  },
  "Objective-C": { imports: [{ re: /^\s*#\s*(?:import|include)\s*"([^"]+)"/, kind: "include" }], symbols: [{ re: /^\s*@(interface|implementation|protocol)\s+(\w+)/, kind: 1 }], main: [{ re: /^\s*int\s+main\s*\(/m, reason: "defines main()" }] },
  Shell: { imports: [{ re: /^\s*(?:source|\.)\s+['"]?([^\s'"]+)/, kind: "source" }], symbols: [{ re: /^\s*(?:function\s+)?(\w+)\s*\(\)\s*\{/, kind: "function", nameGroup: 1 }], main: [] },
  Lua: { imports: [{ re: /require\s*\(?\s*['"]([^'"]+)['"]/, kind: "require" }], symbols: [{ re: /^\s*(?:local\s+)?function\s+([\w.:]+)/, kind: "function", nameGroup: 1 }], main: [] },
  R: { imports: [{ re: /^\s*(?:library|require)\s*\(\s*['"]?(\w[\w.]*)/, kind: "library" }], symbols: [{ re: /^\s*(\w+)\s*<-\s*function\s*\(/, kind: "function", nameGroup: 1 }], main: [] },
  SQL: { imports: [], symbols: [{ re: /^\s*create\s+(?:or\s+replace\s+)?(table|view|function|procedure)\s+(?:if\s+not\s+exists\s+)?([\w."]+)/i, kind: 1 }], main: [] },
};
RULES.Groovy = RULES.Java;
RULES["Visual Basic"] = { imports: [{ re: /^\s*Imports\s+([\w.]+)/i, kind: "import" }], symbols: [], main: [] };

export const genericAnalyzer = {
  id: "generic-pattern",
  name: "Generic (pattern-based)",
  depth: "pattern",
  languages: Object.keys(RULES),
  supports(language) {
    return Object.prototype.hasOwnProperty.call(RULES, language);
  },
  analyze(file) {
    const rule = RULES[file.language];
    const facts = { imports: [], symbols: [], routes: [], apiCalls: [], models: [] };
    if (!rule) return facts;

    const lines = file.content.split("\n");
    const pkg = file.language === "Go" ? /^package\s+(\w+)/m.exec(file.content)?.[1] : null;
    if (pkg) facts.package = pkg;

    // Go: single and grouped imports.
    if (file.language === "Go") {
      let inBlock = false;
      lines.forEach((line, i) => {
        if (/^import\s*\(/.test(line)) return void (inBlock = true);
        if (inBlock && /^\)/.test(line)) return void (inBlock = false);
        const m = inBlock ? /^\s*(?:[\w.]+\s+)?"([^"]+)"/.exec(line) : /^import\s+(?:[\w.]+\s+)?"([^"]+)"/.exec(line);
        if (m && facts.imports.length < MAX.imports) facts.imports.push({ spec: m[1], line: i + 1, kind: "import" });
      });
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 400) continue; // minified/generated lines
      for (const r of rule.imports) {
        const m = r.re.exec(line);
        if (m && facts.imports.length < MAX.imports) {
          facts.imports.push({ spec: m[1], line: i + 1, kind: r.kind, ...(m[2] === ".*" ? { wildcard: true } : {}) });
          break;
        }
      }
      for (const r of rule.symbols) {
        const m = r.re.exec(line);
        if (m && facts.symbols.length < MAX.symbols) {
          const name = r.nameGroup ? m[r.nameGroup] : m[2];
          const kind = typeof r.kind === "number" ? m[r.kind].toLowerCase() : r.kind;
          if (name) facts.symbols.push({ name, kind, line: i + 1, exported: file.language === "Go" ? /^[A-Z]/.test(name) : undefined });
          break;
        }
      }
    }

    for (const m of rule.main) {
      if (m.re.test(file.content)) {
        facts.hasMain = true;
        facts.mainReason = m.reason;
        break;
      }
    }
    if (file.language === "Go" && pkg === "main" && /^func\s+main\s*\(/m.test(file.content)) {
      facts.hasMain = true;
      facts.mainReason = "is package main and declares func main";
    }
    if (file.language === "Dart" && /\brunApp\s*\(/.test(file.content)) {
      facts.hasMain = true;
      facts.mainReason = "calls runApp() (Flutter)";
    }
    return facts;
  },
};
