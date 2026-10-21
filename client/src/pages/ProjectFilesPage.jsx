import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { FileCode2 } from "lucide-react";
import { projectsApi } from "../lib/api.js";
import FileTree from "../features/code-explorer/FileTree.jsx";
import CodeViewer, { parseRange } from "../features/code-explorer/CodeViewer.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";

export default function ProjectFilesPage() {
  const { project } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ loading: true });
  const path = params.get("path");
  const range = parseRange(params.get("lines"));
  const importDone = project.ingestionStatus === "done";

  useEffect(() => {
    if (!importDone) return setState({ loading: false, files: [] });
    let cancelled = false;
    setState({ loading: true });
    projectsApi
      .files(project.id)
      .then((d) => !cancelled && setState({ files: d.files }))
      .catch((e) => !cancelled && setState({ error: e.friendly }));
    return () => {
      cancelled = true;
    };
  }, [project.id, importDone]);

  const select = (p) => setParams({ path: p });
  const selectRange = ({ start, end }) => setParams({ path, lines: start === end ? String(start) : `${start}-${end}` }, { replace: true });

  if (state.loading) return <Skeleton className="h-96" />;
  if (state.error) return <p role="alert" className="text-sm text-danger">{state.error}</p>;

  if (!importDone) {
    return (
      <div className="card px-6 py-12 text-center text-sm text-muted">
        Files appear here once the import has finished.
      </div>
    );
  }
  if (state.files.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-medium">No readable files were stored</p>
        <p className="mt-1 text-sm text-muted">Every file in this repository was filtered out (binary, generated, or over the size limit). See the import summary on the Overview tab.</p>
      </div>
    );
  }

  return (
    <div className="card grid h-[calc(100vh-17rem)] min-h-[420px] animate-fade-up overflow-hidden lg:grid-cols-[320px_1fr]">
      <aside className="min-h-0 border-b border-border bg-sidebar/60 lg:border-b-0 lg:border-r">
        <FileTree files={state.files} selectedPath={path} onSelect={select} />
      </aside>
      <section className="min-h-0 min-w-0">
        {path ? (
          <CodeViewer key={path} projectId={project.id} path={path} range={range} onSelectRange={selectRange} />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-muted">
            <div>
              <FileCode2 size={28} className="mx-auto text-purple" />
              <p className="mt-3 text-sm">Select a file to read it.</p>
              <p className="mt-1 text-xs">Click a line number to highlight it; shift-click to select a range.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
