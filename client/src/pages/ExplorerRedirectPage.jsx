import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { DownloadCloud } from "lucide-react";
import { projectsApi } from "../lib/api.js";
import Skeleton from "../components/ui/Skeleton.jsx";

// "Codebase Explorer" in the sidebar opens the files of the most recently opened project.
export default function ExplorerRedirectPage() {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    projectsApi
      .list({ sort: "accessed", limit: 1 })
      .then((d) => setState({ id: d.projects[0]?.id ?? null }))
      .catch((e) => setState({ error: e.friendly }));
  }, []);

  if (state.loading) return <Skeleton className="h-40" />;
  if (state.error) return <p role="alert" className="text-sm text-danger">{state.error}</p>;
  if (state.id) return <Navigate to={`/app/projects/${state.id}/files`} replace />;
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <h1 className="text-lg font-medium">No project to explore yet</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">Import a repository first, then browse its files here.</p>
      <Link to="/app/import" className="btn-primary mt-5"><DownloadCloud size={16} /> Import repository</Link>
    </div>
  );
}
