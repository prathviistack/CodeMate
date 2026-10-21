import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { projectsApi, notifyProjectsChanged } from "../../lib/api.js";
import { useToast } from "../../components/ui/Toast.jsx";
import RenameDialog from "./RenameDialog.jsx";
import DeleteDialog from "./DeleteDialog.jsx";

// Three-dot menu shared by project cards and the workspace header.
export default function ProjectMenu({ project, onChanged, onDeleted }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // "rename" | "delete"
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggleArchive() {
    setOpen(false);
    try {
      const updated = project.archived ? await projectsApi.restore(project.id) : await projectsApi.archive(project.id);
      notifyProjectsChanged();
      onChanged?.(updated);
      toast.success(project.archived ? "Project restored" : "Project archived");
    } catch (err) {
      toast.error(err.friendly);
    }
  }

  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-card";

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 text-muted transition hover:bg-elevated hover:text-ink" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${project.name}`}>
        <MoreVertical size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-44 animate-pop rounded-xl border border-border bg-elevated p-1.5 shadow-xl">
          <button role="menuitem" className={item} onClick={() => { setOpen(false); setDialog("rename"); }}><Pencil size={15} /> Rename</button>
          <button role="menuitem" className={item} onClick={toggleArchive}>
            {project.archived ? <><ArchiveRestore size={15} /> Restore</> : <><Archive size={15} /> Archive</>}
          </button>
          <button role="menuitem" className={`${item} text-danger`} onClick={() => { setOpen(false); setDialog("delete"); }}><Trash2 size={15} /> Delete…</button>
        </div>
      )}
      {dialog === "rename" && <RenameDialog project={project} onClose={() => setDialog(null)} onRenamed={onChanged} />}
      {dialog === "delete" && <DeleteDialog project={project} onClose={() => setDialog(null)} onDeleted={onDeleted} />}
    </div>
  );
}
