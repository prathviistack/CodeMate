import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, FolderGit2, ChevronLeft, ChevronRight } from "lucide-react";
import { projectsApi } from "../lib/api.js";
import ProjectCard from "../features/projects/ProjectCard.jsx";
import { useProjectsChanged } from "../features/projects/useProjectsChanged.js";
import { usePollWhile } from "../features/projects/usePollWhile.js";
import { useImportDialog } from "../features/repositories/ImportDialogContext.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";

const select = "input !w-auto !py-1.5";

export default function ProjectsPage() {
  const importDialog = useImportDialog();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [search, setSearch] = useState(q);
  const [archived, setArchived] = useState("false");
  const [sort, setSort] = useState("activity");
  const [analysis, setAnalysis] = useState("");
  const [learning, setLearning] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, projects: [], total: 0, pages: 1 });
  const [error, setError] = useState("");

  // Keep the box in sync when the topbar search navigates here.
  useEffect(() => setSearch(q), [q]);
  // Debounce typing into the URL query.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== q) {
        setParams(search ? { q: search } : {}, { replace: true });
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

  const load = useCallback(() => {
    setError("");
    projectsApi
      .list({ q: q || undefined, archived, sort, analysis: analysis || undefined, learning: learning || undefined, page, limit: 12 })
      .then((d) => setState({ loading: false, ...d }))
      .catch((e) => {
        setError(e.friendly);
        setState((s) => ({ ...s, loading: false }));
      });
  }, [q, archived, sort, analysis, learning, page]);

  useEffect(load, [load]);
  useProjectsChanged(load);
  usePollWhile(state.projects.some((p) => p.ingestionStatus === "running"), load, 3000);

  const filtered = Boolean(q || analysis || learning);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted">One saved project per imported repository.</p>
        </div>
        <button className="btn-primary" onClick={importDialog.open}><Plus size={16} /> Import repository</button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !pl-9" placeholder="Search by name, repository, owner or number…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search projects" />
        </div>
        <select className={select} value={archived} onChange={(e) => { setArchived(e.target.value); setPage(1); }} aria-label="Show">
          <option value="false">Active</option>
          <option value="true">Archived</option>
          <option value="all">All</option>
        </select>
        <select className={select} value={analysis} onChange={(e) => { setAnalysis(e.target.value); setPage(1); }} aria-label="Analysis status">
          <option value="">Any analysis</option>
          <option value="pending">Awaiting analysis</option>
          <option value="running">Analyzing</option>
          <option value="ready">Analysis ready</option>
          <option value="failed">Analysis failed</option>
        </select>
        <select className={select} value={learning} onChange={(e) => { setLearning(e.target.value); setPage(1); }} aria-label="Learning status">
          <option value="">Any learning status</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">Learning</option>
          <option value="completed">Completed</option>
        </select>
        <select className={select} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort by">
          <option value="activity">Last activity</option>
          <option value="accessed">Last opened</option>
          <option value="created">Newest first</option>
          <option value="number">Project number</option>
          <option value="name">Name</option>
        </select>
      </div>

      {error && <div role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="mt-6">
        {state.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
          </div>
        ) : state.projects.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-elevated text-purple"><FolderGit2 size={22} /></span>
            <h2 className="mt-4 text-lg font-medium">
              {filtered ? "No projects match your filters" : archived === "true" ? "No archived projects" : "No projects yet"}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              {filtered ? "Try a different search or clear the filters." : archived === "true" ? "Archived projects appear here and can be restored any time." : "Import a public GitHub repository to create your first project."}
            </p>
            {!filtered && archived !== "true" && <button className="btn-primary mt-5" onClick={importDialog.open}><Plus size={16} /> Import repository</button>}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {state.projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} onChanged={load} />)}
            </div>
            {state.pages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted">
                <button className="btn-ghost !px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
                <span>Page {state.page} of {state.pages} · {state.total} projects</span>
                <button className="btn-ghost !px-2" disabled={page >= state.pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
