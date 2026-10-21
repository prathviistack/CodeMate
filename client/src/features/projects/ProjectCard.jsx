import { Link } from "react-router-dom";
import { Clock, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { AnalysisBadge, LearningBadge } from "./StatusBadge.jsx";
import ProjectMenu from "./ProjectMenu.jsx";
import { timeAgo } from "../../lib/format.js";

function ImportState({ project }) {
  const s = project.ingestionStatus;
  if (s === "running") return <p className="mt-3 flex items-center gap-1.5 text-xs text-teal"><Loader2 size={12} className="animate-spin" /> Importing files…</p>;
  if (s === "failed") return <p className="mt-3 flex items-center gap-1.5 text-xs text-danger"><AlertTriangle size={12} /> File import failed. Open to retry.</p>;
  if (s === "done") return <p className="mt-3 text-xs text-muted">{project.ingestionStats?.storedFiles?.toLocaleString() ?? 0} files imported</p>;
  return <p className="mt-3 text-xs text-muted">Files not imported yet</p>;
}

export default function ProjectCard({ project, index = 0, onChanged }) {
  const detected = project.languages?.slice(0, 3) ?? [];
  return (
    <div
      className="card group flex animate-fade-up flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-purple/50"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-muted">#{project.number}</span>
            {project.archived && <span className="rounded border border-warning/40 px-1.5 py-0.5 text-[11px] text-warning">Archived</span>}
          </div>
          <h3 className="mt-2 truncate text-base font-semibold" title={project.name}>{project.name}</h3>
          <p className="mt-0.5 truncate font-mono text-xs text-muted" title={`${project.repoOwner}/${project.repoName}`}>
            {project.repoOwner}/{project.repoName}
          </p>
        </div>
        <ProjectMenu project={project} onChanged={onChanged} onDeleted={onChanged} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {detected.length > 0 ? (
          detected.map((l) => <span key={l} className="rounded-md bg-elevated px-2 py-0.5 text-xs">{l}</span>)
        ) : project.githubLanguage ? (
          <span className="rounded-md bg-elevated px-2 py-0.5 text-xs text-muted" title="Reported by GitHub. CodeMate's own detection has not run yet.">
            {project.githubLanguage} <span className="opacity-60">(GitHub)</span>
          </span>
        ) : (
          <span className="text-xs text-muted">Languages not detected yet</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AnalysisBadge status={project.analysisStatus} />
        <LearningBadge status={project.learningStatus} />
      </div>

      <ImportState project={project} />

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <span className="flex items-center gap-1.5 text-xs text-muted"><Clock size={13} /> {timeAgo(project.lastAccessedAt)}</span>
        <Link to={`/app/projects/${project.id}`} className="btn-primary !px-3 !py-1.5">
          Open <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
