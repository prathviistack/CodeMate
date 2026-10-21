import { useCallback, useEffect, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { projectsApi } from "../../lib/api.js";
import { useProjectsChanged } from "../../features/projects/useProjectsChanged.js";

// Only visible while inside a project workspace.
export default function ProjectSelector() {
  const match = useMatch("/app/projects/:projectId/*");
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);

  const load = useCallback(() => {
    projectsApi.list({ archived: "all", sort: "number", limit: 50 }).then((d) => setProjects(d.projects)).catch(() => {});
  }, []);
  useEffect(() => { if (match) load(); }, [match, load]);
  useProjectsChanged(load);

  if (!match || projects.length === 0) return null;
  return (
    <select
      className="input !w-auto max-w-[200px] !py-1.5"
      value={match.params.projectId}
      onChange={(e) => navigate(`/app/projects/${e.target.value}`)}
      aria-label="Switch project"
    >
      {!projects.some((p) => p.id === match.params.projectId) && <option value={match.params.projectId}>Current project</option>}
      {projects.map((p) => (
        <option key={p.id} value={p.id}>#{p.number} · {p.name}{p.archived ? " (archived)" : ""}</option>
      ))}
    </select>
  );
}
