import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DownloadCloud, FolderGit2, Plus, ArrowRight } from "lucide-react";
import StatusCard from "../features/dashboard/StatusCard.jsx";
import ProjectCard from "../features/projects/ProjectCard.jsx";
import { useProjectsChanged } from "../features/projects/useProjectsChanged.js";
import { usePollWhile } from "../features/projects/usePollWhile.js";
import { useImportDialog } from "../features/repositories/ImportDialogContext.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { projectsApi } from "../lib/api.js";
import Skeleton from "../components/ui/Skeleton.jsx";

function Stat({ label, value, delay }) {
  return (
    <div className="card animate-fade-up p-4" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const importDialog = useImportDialog();
  const [data, setData] = useState({ loading: true });

  const load = useCallback(() => {
    Promise.all([projectsApi.stats(), projectsApi.list({ sort: "accessed", limit: 3 })])
      .then(([stats, recent]) => setData({ stats, recent: recent.projects }))
      .catch((e) => setData({ error: e.friendly }));
  }, []);
  useEffect(load, [load]);
  useProjectsChanged(load);
  usePollWhile(Boolean(data.recent?.some((p) => p.ingestionStatus === "running")), load, 3000);

  const empty = data.stats && data.stats.total === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted">Your codebase, understood.</p>
        </div>
        <button className="btn-primary" onClick={importDialog.open}><DownloadCloud size={16} /> Import Repository</button>
      </div>

      {data.error && <div role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{data.error}</div>}

      {data.loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : data.stats && !empty ? (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Repositories imported" value={data.stats.total} delay={0} />
          <Stat label="Awaiting / in analysis" value={data.stats.analyzing} delay={60} />
          <Stat label="Analysis complete" value={data.stats.analyzed} delay={120} />
          <Stat label="Currently learning" value={data.stats.learning} delay={180} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {empty ? (
            <div className="card animate-fade-up p-8 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-elevated text-purple"><FolderGit2 size={22} /></span>
              <h2 className="mt-4 text-lg font-medium">No projects yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">Paste a public GitHub repository URL to create your first project. It will be saved here so you can come back to it any time.</p>
              <button className="btn-primary mt-5" onClick={importDialog.open}><Plus size={16} /> Import your first repository</button>
            </div>
          ) : data.recent ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-medium">Recently opened</h2>
                <Link to="/app/projects" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">All projects <ArrowRight size={14} /></Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 lg:grid-cols-2">
                {data.recent.map((p, i) => <ProjectCard key={p.id} project={p} index={i} onChanged={load} />)}
              </div>
              <p className="mt-4 text-xs text-muted">Lessons, quiz results and learning activity will appear here once those features are built.</p>
            </>
          ) : null}
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "140ms" }}><StatusCard /></div>
      </div>
    </div>
  );
}
