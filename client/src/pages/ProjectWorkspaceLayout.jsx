import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { projectsApi, notifyProjectsChanged } from "../lib/api.js";
import { AnalysisBadge, LearningBadge } from "../features/projects/StatusBadge.jsx";
import ProjectMenu from "../features/projects/ProjectMenu.jsx";
import { useProjectsChanged } from "../features/projects/useProjectsChanged.js";
import { usePollWhile } from "../features/projects/usePollWhile.js";
import IngestionPanel from "../features/repositories/IngestionPanel.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { useToast } from "../components/ui/Toast.jsx";

const tab = ({ isActive }) =>
  `border-b-2 px-3 py-2 text-sm transition-colors ${isActive ? "border-purple text-ink" : "border-transparent text-muted hover:text-ink"}`;

export default function ProjectWorkspaceLayout() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [state, setState] = useState({ loading: true });
  const wasRunning = useRef(false);

  const load = useCallback(() => {
    projectsApi
      .get(projectId)
      .then((project) => setState({ project }))
      .catch((e) => setState({ error: e.response?.status === 404 ? "notfound" : e.friendly }));
  }, [projectId]);

  useEffect(() => {
    setState({ loading: true });
    wasRunning.current = false;
    load();
  }, [load]);
  useProjectsChanged(load);

  const project = state.project;
  const running = project?.ingestionStatus === "running";

  // Follow a running import without touching "last opened".
  usePollWhile(running, () => {
    projectsApi
      .ingestion(projectId)
      .then((ing) => setState((s) => (s.project ? { project: { ...s.project, ...ing } } : s)))
      .catch(() => {});
  });

  useEffect(() => {
    if (running) wasRunning.current = true;
    else if (wasRunning.current && project) {
      wasRunning.current = false;
      if (project.ingestionStatus === "done") toast.success("Repository files imported");
      else if (project.ingestionStatus === "failed") toast.error("The file import failed");
      notifyProjectsChanged();
    }
  }, [running, project, toast]);

  if (state.loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48" /></div>;
  if (state.error) {
    return (
      <div className="card flex flex-col items-center px-6 py-16 text-center">
        <h1 className="text-lg font-medium">{state.error === "notfound" ? "Project not found" : "Could not load project"}</h1>
        <p className="mt-1 text-sm text-muted">{state.error === "notfound" ? "It may have been deleted, or it doesn't belong to your account." : state.error}</p>
        <Link to="/app/projects" className="btn-ghost mt-5"><ArrowLeft size={16} /> Back to projects</Link>
      </div>
    );
  }

  const p = project;
  const setProject = (next) => setState({ project: next });

  return (
    <div>
      <Link to="/app/projects" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Projects</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-muted">#{p.number}</span>
            {p.archived && <span className="rounded border border-warning/40 px-1.5 py-0.5 text-[11px] text-warning">Archived</span>}
          </div>
          <h1 className="mt-1.5 truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
          <a href={p.githubUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-muted hover:text-purple">
            {p.repoOwner}/{p.repoName} <ExternalLink size={13} />
          </a>
        </div>
        <ProjectMenu project={p} onChanged={setProject} onDeleted={() => navigate("/app/projects", { replace: true })} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AnalysisBadge status={p.analysisStatus} />
        <LearningBadge status={p.learningStatus} />
      </div>

      <nav className="mt-5 flex gap-1 border-b border-border" aria-label="Project sections">
        <NavLink end to={`/app/projects/${p.id}`} className={tab}>Overview</NavLink>
        <NavLink to={`/app/projects/${p.id}/files`} className={tab}>Files</NavLink>
        <NavLink to={`/app/projects/${p.id}/tutor`} className={tab}>Tutor</NavLink>
        <NavLink to={`/app/projects/${p.id}/lessons`} className={tab}>Learning</NavLink>
        <NavLink to={`/app/projects/${p.id}/quizzes`} className={tab}>Quizzes</NavLink>
      </nav>

      <div className="mt-6 space-y-4">
        <IngestionPanel project={p} onChange={setProject} />
        <Outlet context={{ project: p, setProject, reload: load }} />
      </div>
    </div>
  );
}
