import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, ShieldCheck, Info } from "lucide-react";
import { projectsApi } from "../../lib/api.js";
import { highlightLines } from "./highlight.js";
import { formatKb } from "../../lib/format.js";
import Skeleton from "../../components/ui/Skeleton.jsx";
import { useToast } from "../../components/ui/Toast.jsx";

const MAX_RENDER_LINES = 5000;

export function parseRange(value) {
  const m = /^(\d{1,7})(?:-(\d{1,7}))?$/.exec(value || "");
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2] ?? m[1]);
  return start >= 1 && end >= start ? { start, end } : null;
}

// Read-only, syntax-highlighted source view with line numbers and a highlightable line range.
export default function CodeViewer({ projectId, path, range, onSelectRange }) {
  const toast = useToast();
  const [state, setState] = useState({ loading: true });
  const [hl, setHl] = useState(null);
  const anchor = useRef(null);
  const scrolledFor = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });
    setHl(null);
    projectsApi
      .fileContent(projectId, path)
      .then((d) => {
        if (cancelled) return;
        setState({ data: d });
        highlightLines(d.file.content, d.file.language).then((lines) => !cancelled && setHl(lines));
      })
      .catch((e) => !cancelled && setState({ error: e.response?.status === 404 ? "This file is not in the imported snapshot." : e.friendly }));
    return () => {
      cancelled = true;
    };
  }, [projectId, path]);

  const plainLines = useMemo(() => (state.data ? state.data.file.content.replace(/\n$/, "").split("\n") : []), [state.data]);

  // Scroll the first highlighted line into view once per opened file / range.
  useEffect(() => {
    if (!state.data || !range) return;
    const key = `${path}:${range.start}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;
    document.getElementById(`L${range.start}`)?.scrollIntoView({ block: "center" });
  }, [state.data, range, path]);

  if (state.loading) return <div className="space-y-2 p-4">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-4" />)}</div>;
  if (state.error) return <p role="alert" className="p-6 text-sm text-danger">{state.error}</p>;

  const { file, snapshotSha, githubUrl } = state.data;
  const total = plainLines.length;
  const shown = Math.min(total, MAX_RENDER_LINES);

  function clickLine(n, e) {
    if (e.shiftKey && anchor.current) {
      const a = anchor.current;
      onSelectRange({ start: Math.min(a, n), end: Math.max(a, n) });
    } else {
      anchor.current = n;
      onSelectRange({ start: n, end: n });
    }
  }

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(file.path);
      toast.success("Path copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2.5 text-xs text-muted">
        <span className="min-w-0 truncate font-mono text-[13px] text-ink" title={file.path}>{file.path}</span>
        <span className="rounded bg-elevated px-1.5 py-0.5">{file.language}</span>
        <span>{file.lines.toLocaleString()} lines · {formatKb(Math.max(1, Math.ceil(file.size / 1024)))}</span>
        <span className="ml-auto flex items-center gap-1">
          <button className="rounded p-1.5 hover:bg-elevated hover:text-ink" onClick={copyPath} aria-label="Copy file path"><Copy size={14} /></button>
          <a className="rounded p-1.5 hover:bg-elevated hover:text-ink" href={`${githubUrl}/blob/${snapshotSha}/${file.path.split("/").map(encodeURIComponent).join("/")}`} target="_blank" rel="noopener noreferrer" aria-label="Open this file on GitHub at the imported commit" title="Open on GitHub at the imported commit">
            <ExternalLink size={14} />
          </a>
        </span>
      </div>

      {(file.redactions > 0 || file.note) && (
        <div className="space-y-1 border-b border-border bg-elevated/50 px-4 py-2 text-xs">
          {file.redactions > 0 && <p className="flex items-center gap-1.5 text-teal"><ShieldCheck size={13} /> {file.redactions} secret-like value{file.redactions > 1 ? "s were" : " was"} replaced with [REDACTED].</p>}
          {file.note && <p className="flex items-center gap-1.5 text-muted"><Info size={13} /> {file.note}</p>}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto bg-bg/40 py-2 font-mono text-[13px] leading-6" role="region" aria-label={`Source of ${file.path}`} tabIndex={0}>
        <div className="min-w-max">
          {Array.from({ length: shown }, (_, i) => {
            const n = i + 1;
            const selected = range && n >= range.start && n <= range.end;
            return (
              <div key={n} id={`L${n}`} className={`flex ${selected ? "bg-purple/15" : ""}`}>
                <button
                  onClick={(e) => clickLine(n, e)}
                  className={`sticky left-0 w-14 shrink-0 select-none bg-inherit pr-3 text-right text-xs tabular-nums ${selected ? "text-purple" : "text-muted/60 hover:text-ink"}`}
                  style={{ backgroundColor: selected ? "rgba(139,124,255,.15)" : "#0B0D12" }}
                  aria-label={`Select line ${n}`}
                >
                  {n}
                </button>
                {hl ? (
                  <code className="whitespace-pre pr-6" dangerouslySetInnerHTML={{ __html: hl[i] || " " }} />
                ) : (
                  <code className="whitespace-pre pr-6">{plainLines[i] || " "}</code>
                )}
              </div>
            );
          })}
          {total > shown && <p className="px-4 py-3 text-xs text-muted">Showing the first {shown.toLocaleString()} of {total.toLocaleString()} lines.</p>}
        </div>
      </div>
    </div>
  );
}
