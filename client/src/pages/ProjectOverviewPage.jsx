import { useOutletContext } from "react-router-dom";
import { GitBranch, Star, Hourglass, AlertCircle, CheckCircle, Loader } from "lucide-react";
import ImportSummary from "../features/repositories/ImportSummary.jsx";
import { formatDate, formatKb } from "../lib/format.js";

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

export default function ProjectOverviewPage() {
  const { project: p } = useOutletContext();
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="card animate-fade-up p-6 lg:col-span-2">
        <h2 className="font-medium">Repository</h2>
        <p className="mt-2 text-sm text-muted">{p.repoDescription || "This repository has no description on GitHub."}</p>
        <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3">
          <Field label="Owner">{p.repoOwner}</Field>
          <Field label="Repository">{p.repoName}</Field>
          <Field label="Default branch"><span className="inline-flex items-center gap-1"><GitBranch size={13} /> {p.defaultBranch}</span></Field>
          <Field label="Imported commit"><span className="font-mono text-xs" title={p.snapshotSha}>{p.snapshotSha.slice(0, 10)}</span></Field>
          <Field label="Stars"><span className="inline-flex items-center gap-1"><Star size={13} /> {p.stars.toLocaleString()}</span></Field>
          <Field label="Size on GitHub">{formatKb(p.repoSizeKb)}</Field>
          <Field label="Imported">{formatDate(p.createdAt)}</Field>
          <Field label="Main language (GitHub)">{p.githubLanguage || "—"}</Field>
        </dl>
      </section>

      <section className="card animate-fade-up p-6" style={{ animationDelay: "80ms" }}>
        <h2 className="font-medium">Detected technologies</h2>
        {p.analysisStatus === "running" && (
          <div className="mt-4 flex items-start gap-3 text-sm text-muted">
            <Loader size={16} className="mt-0.5 shrink-0 animate-spin text-purple" />
            <p>Analyzing technologies...</p>
          </div>
        )}
        {p.analysisStatus === "ready" && (p.languages?.length || p.frameworks?.length) ? (
          <div>
            {p.summary && <p className="mt-2 text-sm text-muted">{p.summary}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...p.languages, ...p.frameworks].map((t) => <span key={t} className="rounded-md bg-elevated px-2 py-0.5 text-xs">{t}</span>)}
            </div>
          </div>
        ) : p.analysisStatus === "ready" ? (
          <div className="mt-4 flex items-start gap-3 text-sm text-muted">
            <Hourglass size={16} className="mt-0.5 shrink-0 text-muted" />
            <p>No manifest files detected. CodeMate couldn't identify specific frameworks, but you can explore the code to see what technologies are used.</p>
          </div>
        ) : p.analysisStatus === "failed" ? (
          <div className="mt-4 flex items-start gap-3 text-sm text-muted">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-orange" />
            <p>Analysis failed. You can still explore the code to learn about this repository.</p>
          </div>
        ) : p.analysisStatus === "pending" ? (
          <div className="mt-4 flex items-start gap-3 text-sm text-muted">
            <Hourglass size={16} className="mt-0.5 shrink-0 text-purple" />
            <p>Waiting to analyze...</p>
          </div>
        ) : null}
      </section>

      {p.ingestionStatus === "done" && <div className="lg:col-span-3"><ImportSummary stats={p.ingestionStats} /></div>}
    </div>
  );
}
