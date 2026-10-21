import { ShieldCheck, TriangleAlert } from "lucide-react";
import { formatKb } from "../../lib/format.js";

const REASONS = {
  ignored_dir: "Dependency, build and cache folders",
  generated: "Lock files and generated files",
  minified: "Minified bundles and source maps",
  binary: "Binary and media files",
  too_large: "Files over the size limit",
  empty: "Empty files",
  sensitive_file: "Secret and credential files (never read)",
  contains_secret: "Files containing private keys (never stored)",
  unsafe_path: "Files with unsafe paths",
  link: "Symbolic links",
  unreadable: "Unreadable notebooks",
  over_limit: "Beyond CodeMate's storage limits",
};

export default function ImportSummary({ stats }) {
  if (!stats) return null;
  const skipped = Object.entries(stats.skipped || {}).sort((a, b) => b[1] - a[1]);
  return (
    <section className="card animate-fade-up p-6" style={{ animationDelay: "120ms" }}>
      <h2 className="font-medium">Import summary</h2>
      <p className="mt-2 text-sm">
        <strong>{stats.storedFiles.toLocaleString()}</strong> files stored
        <span className="text-muted"> ({formatKb(Math.ceil(stats.storedBytes / 1024))}) from {stats.totalFiles.toLocaleString()} in the repository</span>
      </p>

      {stats.truncated && (
        <div className="mt-3 flex gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <p>This repository is larger than CodeMate stores, so lower-priority files (tests, docs, data) were left out first. Source and manifests were kept where possible.</p>
        </div>
      )}
      {stats.redactedFiles > 0 && (
        <div className="mt-3 flex gap-2.5 rounded-lg border border-teal/40 bg-teal/10 p-3 text-sm text-teal">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <p>Secret-like values were removed from {stats.redactedFiles} file{stats.redactedFiles > 1 ? "s" : ""}. They are not stored, shown, or sent to the AI.</p>
        </div>
      )}

      {skipped.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">{stats.skippedFiles.toLocaleString()} files skipped</summary>
          <ul className="mt-2 space-y-1 text-muted">
            {skipped.map(([reason, n]) => (
              <li key={reason} className="flex justify-between gap-4"><span>{REASONS[reason] || reason}</span><span className="tabular-nums">{n.toLocaleString()}</span></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
