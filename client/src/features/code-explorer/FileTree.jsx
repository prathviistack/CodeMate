import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Folder, FolderOpen, FileText, Search } from "lucide-react";
import { buildTree, ancestorsOf } from "./buildTree.js";

const MAX_SEARCH_RESULTS = 200;

function Row({ depth, children, selected, onClick, ariaExpanded }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[13px] transition-colors ${
        selected ? "bg-purple/15 text-ink" : "text-muted hover:bg-elevated hover:text-ink"
      }`}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      {children}
    </button>
  );
}

function Node({ node, depth, expanded, toggle, selectedPath, onSelect }) {
  if (node.type === "file") {
    return (
      <Row depth={depth} selected={node.path === selectedPath} onClick={() => onSelect(node.path)}>
        <FileText size={14} className="shrink-0 opacity-70" />
        <span className="truncate" title={node.path}>{node.name}</span>
      </Row>
    );
  }
  const open = expanded.has(node.path);
  return (
    <div>
      <Row depth={depth} onClick={() => toggle(node.path)} ariaExpanded={open}>
        <ChevronRight size={14} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        {open ? <FolderOpen size={14} className="shrink-0 text-purple" /> : <Folder size={14} className="shrink-0 text-purple" />}
        <span className="truncate">{node.name}</span>
      </Row>
      {open && node.children.map((c) => <Node key={c.path} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} selectedPath={selectedPath} onSelect={onSelect} />)}
    </div>
  );
}

export default function FileTree({ files, selectedPath, onSelect }) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set(tree.children.filter((c) => c.type === "dir").slice(0, 3).map((c) => c.path)));

  // Keep the selected file visible (e.g. when opened from a link).
  useEffect(() => {
    if (!selectedPath) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      ancestorsOf(selectedPath).forEach((a) => next.add(a));
      return next.size === prev.size ? prev : next;
    });
  }, [selectedPath]);

  const toggle = (path) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? files.filter((f) => f.path.toLowerCase().includes(q)) : []), [files, q]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative p-2">
        <Search size={14} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input !py-1.5 !pl-8 text-[13px]" placeholder={`Filter ${files.length.toLocaleString()} files…`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter files" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2" role="tree" aria-label="Repository files">
        {q ? (
          matches.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">No files match “{query}”.</p>
          ) : (
            <>
              {matches.slice(0, MAX_SEARCH_RESULTS).map((f) => (
                <Row key={f.path} depth={0} selected={f.path === selectedPath} onClick={() => onSelect(f.path)}>
                  <FileText size={14} className="shrink-0 opacity-70" />
                  <span className="truncate" title={f.path}>{f.path}</span>
                </Row>
              ))}
              {matches.length > MAX_SEARCH_RESULTS && <p className="px-3 py-2 text-xs text-muted">Showing {MAX_SEARCH_RESULTS} of {matches.length}. Keep typing to narrow down.</p>}
            </>
          )
        ) : (
          tree.children.map((c) => <Node key={c.path} node={c} depth={0} expanded={expanded} toggle={toggle} selectedPath={selectedPath} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}
