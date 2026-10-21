import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";
import { projectsApi, notifyProjectsChanged } from "../../lib/api.js";
import { useToast } from "../../components/ui/Toast.jsx";

export default function DeleteDialog({ project, onClose, onDeleted }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    projectsApi.deletionPreview(project.id).then(setItems).catch(() => setItems([]));
  }, [project.id]);

  async function onDelete() {
    setDeleting(true);
    setError("");
    try {
      await projectsApi.remove(project.id);
      notifyProjectsChanged();
      toast.success(`"${project.name}" was deleted`);
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(err.friendly);
      setDeleting(false);
    }
  }

  const confirmed = typed.trim() === project.name;

  return (
    <Modal open onClose={deleting ? () => {} : onClose} title="Delete project?">
      <div className="space-y-4 text-sm">
        <div className="flex gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-danger">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <p>This permanently removes <strong>{project.name}</strong> from CodeMate. It cannot be undone.</p>
        </div>

        <div>
          <p className="mb-2 text-muted">The following saved data will be deleted:</p>
          {items === null ? (
            <Skeleton className="h-10" />
          ) : (
            <ul className="list-inside list-disc space-y-1">
              <li>The project record and its repository details</li>
              {items.map((i) => (
                <li key={i.label}>{i.count} {i.label}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">
            The repository on GitHub is not affected. Archiving keeps everything and just hides the project.
          </p>
        </div>

        <div>
          <label htmlFor="confirm-name" className="mb-1.5 block">Type <span className="font-mono text-ink">{project.name}</span> to confirm</label>
          <input id="confirm-name" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        {error && <p role="alert" className="text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="btn bg-danger text-[#0B0D12] hover:brightness-110" onClick={onDelete} disabled={!confirmed || deleting}>
            {deleting && <Loader2 size={16} className="animate-spin" />} Delete project
          </button>
        </div>
      </div>
    </Modal>
  );
}
