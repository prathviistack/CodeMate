import { parse } from "@babel/parser";

// JavaScript / TypeScript analyzer. Parses a real AST (no code is executed).
//
// Analyzer interface (shared by all analyzers):
//   { id, name, depth: "ast" | "pattern", languages: string[], analyze(file) -> FileFacts }
// FileFacts: { imports, symbols, routes, apiCalls, models, hasMain?, mainReason?, partial? }
// Anything the AST cannot prove is labelled with `basis: "inferred"`.

const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete", "all", "options", "head"]);
const CLIENT_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const SERVER_FACTORIES = new Set(["express", "Router", "fastify", "Fastify"]);
const MAX = { imports: 300, symbols: 300, routes: 100, apiCalls: 100, models: 50 };

const SKIP_KEYS = new Set(["loc", "start", "end", "range", "extra", "leadingComments", "trailingComments", "innerComments", "comments", "tokens", "errors"]);

function pluginSets(ext) {
  const base = ["decorators-legacy"];
  if (ext === "ts" || ext === "mts" || ext === "cts") return [["typescript", ...base]];
  if (ext === "tsx") return [["typescript", "jsx", ...base]];
  // .js files may contain JSX (React) or Flow (React Native); try the common cases in order.
  return [["jsx", ...base], ["jsx", "flow", ...base], ["typescript", "jsx", ...base]];
}

// Vue / Svelte single-file components: analyze only the <script> block.
function extractScript(content) {
  const m = /<script\b([^>]*)>([\s\S]*?)<\/script>/i.exec(content);
  if (!m) return null;
  const startIndex = m.index + m[0].indexOf(">") + 1;
  return { code: m[2], lineOffset: content.slice(0, startIndex).split("\n").length - 1, ts: /lang\s*=\s*["']ts["']/.test(m[1]) };
}

function walk(root, visit) {
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n || typeof n !== "object") continue;
    if (Array.isArray(n)) {
      for (let i = n.length - 1; i >= 0; i--) stack.push(n[i]);
      continue;
    }
    if (typeof n.type !== "string") continue;
    visit(n);
    for (const k in n) {
      if (SKIP_KEYS.has(k)) continue;
      const v = n[k];
      if (v && typeof v === "object") stack.push(v);
    }
  }
}

const strValue = (n) => {
  if (!n) return null;
  if (n.type === "StringLiteral") return n.value;
  if (n.type === "TemplateLiteral" && n.expressions.length === 0) return n.quasis[0]?.value.cooked ?? null;
  return null;
};
// Template literal URL with placeholders: `/api/projects/${id}` -> "/api/projects/{expr}"
const urlText = (n) => {
  const s = strValue(n);
  if (s !== null) return s;
  if (n?.type === "TemplateLiteral") return n.quasis.map((q, i) => (q.value.cooked ?? "") + (i < n.expressions.length ? "{expr}" : "")).join("");
  return null;
};

function tryParse(code, plugins) {
  return parse(code, {
    sourceType: "unambiguous",
    errorRecovery: true,
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: true,
    allowSuperOutsideMethod: true,
    allowUndeclaredExports: true,
    plugins,
  });
}

function collectSymbols(program, hasJsx, offset) {
  const symbols = [];
  const add = (name, kind, node, exported, basis = "ast") => {
    if (symbols.length < MAX.symbols) symbols.push({ name, kind, line: node.loc.start.line + offset, exported, ...(basis !== "ast" ? { basis } : {}) });
  };
  for (const stmt of program.body) {
    let node = stmt;
    let exported = false;
    if ((stmt.type === "ExportNamedDeclaration" || stmt.type === "ExportDefaultDeclaration") && stmt.declaration) {
      node = stmt.declaration;
      exported = true;
    }
    switch (node.type) {
      case "FunctionDeclaration":
        if (node.id) add(node.id.name, hasJsx && /^[A-Z]/.test(node.id.name) ? "component" : "function", node, exported, hasJsx && /^[A-Z]/.test(node.id.name) ? "naming-convention" : "ast");
        break;
      case "ClassDeclaration":
        if (node.id) add(node.id.name, "class", node, exported);
        break;
      case "TSInterfaceDeclaration":
        add(node.id.name, "interface", node, exported);
        break;
      case "TSTypeAliasDeclaration":
        add(node.id.name, "type", node, exported);
        break;
      case "TSEnumDeclaration":
        add(node.id.name, "enum", node, exported);
        break;
      case "VariableDeclaration":
        for (const d of node.declarations) {
          if (d.id?.type !== "Identifier" || !d.init) continue;
          const t = d.init.type;
          if (t === "ArrowFunctionExpression" || t === "FunctionExpression") {
            const comp = hasJsx && /^[A-Z]/.test(d.id.name);
            add(d.id.name, comp ? "component" : "function", d, exported, comp ? "naming-convention" : "ast");
          } else if (t === "ClassExpression") add(d.id.name, "class", d, exported);
        }
        break;
    }
  }
  return symbols;
}

function analyzeCode(code, ext, offset = 0) {
  let ast;
  let lastErr;
  for (const plugins of pluginSets(ext)) {
    try {
      ast = tryParse(code, plugins);
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!ast) throw lastErr;

  const imports = [];
  const seen = new Set();
  const addImport = (spec, node, kind) => {
    const line = node.loc.start.line + offset;
    const key = `${spec}@${line}`;
    if (!spec || seen.has(key) || imports.length >= MAX.imports) return;
    seen.add(key);
    imports.push({ spec, line, kind });
  };

  const routerVars = new Set();
  const axiosVars = new Set();
  const memberCalls = [];
  const apiCalls = [];
  const models = [];
  let hasJsx = false;
  let hasExpressImport = false;

  walk(ast.program, (n) => {
    switch (n.type) {
      case "ImportDeclaration":
        addImport(n.source.value, n, n.importKind === "type" ? "type-import" : "import");
        break;
      case "ExportAllDeclaration":
      case "ExportNamedDeclaration":
        if (n.source) addImport(n.source.value, n, "re-export");
        break;
      case "ImportExpression": {
        const s = strValue(n.source);
        if (s) addImport(s, n, "dynamic-import");
        break;
      }
      case "JSXElement":
      case "JSXFragment":
        hasJsx = true;
        break;
      case "VariableDeclarator": {
        if (n.id?.type !== "Identifier" || !n.init) break;
        const init = n.init.type === "AwaitExpression" ? n.init.argument : n.init;
        const callee = init.type === "CallExpression" || init.type === "NewExpression" ? init.callee : null;
        if (!callee) break;
        const name = callee.type === "Identifier" ? callee.name : callee.type === "MemberExpression" && callee.property?.type === "Identifier" ? callee.property.name : null;
        if (name && SERVER_FACTORIES.has(name)) routerVars.add(n.id.name);
        if (callee.type === "MemberExpression" && callee.object?.type === "Identifier" && callee.object.name === "axios" && callee.property?.name === "create") axiosVars.add(n.id.name);
        break;
      }
      case "CallExpression": {
        const c = n.callee;
        if (c.type === "Identifier" && c.name === "require") {
          const s = strValue(n.arguments[0]);
          if (s) addImport(s, n, "require");
        } else if (c.type === "Import") {
          const s = strValue(n.arguments[0]);
          if (s) addImport(s, n, "dynamic-import");
        } else if (c.type === "Identifier" && c.name === "fetch") {
          const url = urlText(n.arguments[0]);
          if (url !== null && apiCalls.length < MAX.apiCalls) {
            const opt = n.arguments[1];
            let method = "GET";
            if (opt?.type === "ObjectExpression") {
              const p = opt.properties.find((x) => x.type === "ObjectProperty" && (x.key.name === "method" || x.key.value === "method"));
              const v = p && strValue(p.value);
              if (v) method = v.toUpperCase();
            }
            apiCalls.push({ method, url, line: n.loc.start.line + offset, basis: "fetch-call" });
          }
        } else if (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier") {
          memberCalls.push({
            obj: c.object.type === "Identifier" ? c.object.name : null,
            prop: c.property.name,
            url: urlText(n.arguments[0]),
            handler: n.arguments.length > 1 && n.arguments[n.arguments.length - 1].type === "Identifier" ? n.arguments[n.arguments.length - 1].name : null,
            line: n.loc.start.line + offset,
          });
        }
        break;
      }
    }
  });

  for (const i of imports) if (i.spec === "express" || i.spec === "fastify" || i.spec === "koa-router" || i.spec === "@koa/router") hasExpressImport = true;

  const routes = [];
  for (const m of memberCalls) {
    if (m.prop === "model" && m.obj === "mongoose" && m.url && models.length < MAX.models) {
      models.push({ name: m.url, kind: "mongoose", line: m.line, basis: "mongoose.model call" });
      continue;
    }
    if (m.url === null) continue;
    const isMount = m.prop === "use" && m.url.startsWith("/");
    if (!ROUTE_METHODS.has(m.prop) && !isMount) continue;
    const verified = m.obj && routerVars.has(m.obj);
    if (m.obj && (m.obj === "axios" || axiosVars.has(m.obj)) && CLIENT_METHODS.has(m.prop)) {
      if (apiCalls.length < MAX.apiCalls) apiCalls.push({ method: m.prop.toUpperCase(), url: m.url, line: m.line, basis: "axios-call" });
    } else if (verified || (hasExpressImport && m.url.startsWith("/"))) {
      if (routes.length < MAX.routes) routes.push({ method: isMount ? "USE" : m.prop.toUpperCase(), path: m.url, handler: m.handler, line: m.line, basis: verified ? "router-variable" : "inferred" });
    } else if (CLIENT_METHODS.has(m.prop) && /^(\/|https?:)/.test(m.url) && apiCalls.length < MAX.apiCalls) {
      apiCalls.push({ method: m.prop.toUpperCase(), url: m.url, line: m.line, basis: "inferred" });
    }
  }

  imports.sort((a, b) => a.line - b.line);
  routes.sort((a, b) => a.line - b.line);
  apiCalls.sort((a, b) => a.line - b.line);
  const facts = {
    imports,
    symbols: collectSymbols(ast.program, hasJsx, offset),
    routes,
    apiCalls,
    models,
    partial: Boolean(ast.errors?.length),
  };

  const text = code;
  if (/\.listen\s*\(/.test(text) && (hasExpressImport || routerVars.size)) {
    facts.hasMain = true;
    facts.mainReason = "creates a server and calls .listen()";
  } else if (/createRoot\s*\(|ReactDOM\.render\s*\(|hydrateRoot\s*\(/.test(text)) {
    facts.hasMain = true;
    facts.mainReason = "mounts a React application";
  } else if (/\bcreateApp\s*\([^)]*\)[\s\S]{0,80}\.mount\s*\(/.test(text)) {
    facts.hasMain = true;
    facts.mainReason = "creates and mounts a Vue application";
  } else if (/bootstrapModule\s*\(|bootstrapApplication\s*\(/.test(text)) {
    facts.hasMain = true;
    facts.mainReason = "bootstraps an Angular application";
  } else if (/AppRegistry\.registerComponent\s*\(|registerRootComponent\s*\(/.test(text)) {
    facts.hasMain = true;
    facts.mainReason = "registers the React Native root component";
  }
  return facts;
}

export const jsAnalyzer = {
  id: "js-ast",
  name: "JavaScript / TypeScript (AST)",
  depth: "ast",
  languages: ["JavaScript", "TypeScript", "Vue", "Svelte"],
  analyze(file) {
    const ext = file.path.split(".").pop().toLowerCase();
    if (ext === "vue" || ext === "svelte") {
      const s = extractScript(file.content);
      if (!s) return { imports: [], symbols: [], routes: [], apiCalls: [], models: [] };
      return analyzeCode(s.code, s.ts ? "ts" : "js", s.lineOffset);
    }
    return analyzeCode(file.content, ext);
  },
};
