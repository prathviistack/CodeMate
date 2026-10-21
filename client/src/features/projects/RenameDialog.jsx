import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import FormField from "../auth/FormField.jsx";
import { projectsApi, notifyProjectsChanged } from "../../lib/api.js";
import { useToast } from "../../components/ui/Toast.jsx";

export default function RenameDialog({ project, onClose, onRenamed }) {
  const toast = useToast();
  const [name, setName] = useState(project.name);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Project name cannot be empty");
    if (trimmed.length > 80) return setError("Project name must be at most 80 characters");
    setSaving(true);
    try {
      const updated = await projectsApi.rename(project.id, trimmed);
      notifyProjectsChanged();
      toast.success("Project renamed");
      onRenamed?.(updated);
      onClose();
    } catch (err) {
      setError(err.fieldErrors?.name?.[0] || err.friendly);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Rename project">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField label="Project name" id="rename" value={name} onChange={(e) => setName(e.target.value)} error={error} maxLength={90} />
        <p className="text-xs text-muted">
          This only changes the name shown in CodeMate. The repository <span className="font-mono">{project.repoOwner}/{project.repoName}</span> on GitHub is never modified.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || name.trim() === project.name}>
            {saving && <Loader2 size={16} className="animate-spin" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
