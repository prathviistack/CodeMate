import { useState } from "react";
import { CheckCircle2, Loader2, Circle, AlertTriangle, DownloadCloud } from "lucide-react";
import { projectsApi, notifyProjectsChanged } from "../../lib/api.js";
import { useToast } from "../../components/ui/Toast.jsx";

const STAGES = [
  { key: "downloading", label: "Downloading the repository snapshot and filtering files" },
  { key: "saving", label: "Saving files" },
];

// Shown in the workspace whenever the repository's files are not (yet) imported.
export default function IngestionPanel({ project, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const status = project.ingestionStatus;
  if (status === "done") return null;

  async function start() {
    setBusy(true);
    try {
      const updated = await projectsApi.startImport(project.id);
      onChange(updated);
      notifyProjectsChanged();
    } catch (err) {
      toast.error(err.friendly);
    } finally {
      setBusy(false);
    }
  }

  if (status === "running") {
    const current = STAGES.findIndex((s) => s.key === project.ingestionStage);
    return (
      <section className="card animate-fade-up p-6" aria-live="polite">
        <h2 className="font-medium">Importing repository files…</h2>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label="Import in progress">
          <div className="h-full w-1/4 animate-indeterminate rounded-full bg-gradient-to-r from-purple to-teal" />
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {STAGES.map((s, i) => {
            const done = current > i;
            const active = current === i;
            return (
              <li key={s.key} className={`flex items-center gap-2.5 ${done || active ? "text-ink" : "text-muted"}`}>
                {done ? <CheckCircle2 size={16} className="text-success" /> : active ? <Loader2 size={16} className="animate-spin text-teal" /> : <Circle size={16} />}
                {s.label}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted">Large repositories can take a minute or two. You can leave this page; the import continues on the server.</p>
      </section>
    );
  }

  if (status === "failed") {
    return (
      <section className="card animate-fade-up border-danger/40 p-6" role="alert">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">The file import failed</h2>
            <p className="mt-1 text-sm text-muted">{project.ingestionError || "Something went wrong."}</p>
            <button className="btn-primary mt-4" onClick={start} disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />} Retry import
            </button>
            <p className="mt-2 text-xs text-muted">Retrying reuses this project. It will not create a duplicate.</p>
          </div>
        </div>
      </section>
    );
  }

  // pending and not running (e.g. a project created before file import existed)
  return (
    <section className="card animate-fade-up p-6">
      <div className="flex items-start gap-3">
        <DownloadCloud size={20} className="mt-0.5 shrink-0 text-purple" />
        <div>
          <h2 className="font-medium">Files have not been imported yet</h2>
          <p className="mt-1 text-sm text-muted">Import the repository's source files so you can browse them in CodeMate.</p>
          <button className="btn-primary mt-4" onClick={start} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} Import files
          </button>
        </div>
      </div>
    </section>
  );
}
