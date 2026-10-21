import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Github } from "lucide-react";
import FormField from "../auth/FormField.jsx";
import { projectsApi, notifyProjectsChanged } from "../../lib/api.js";
import { useToast } from "../../components/ui/Toast.jsx";

const GITHUB_RE = /^(https?:\/\/)?(www\.)?github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+/i;

export default function ImportForm({ onDone }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [existingId, setExistingId] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    setExistingId(null);
    const v = {};
    if (!GITHUB_RE.test(url.trim())) v.url = "Use the form https://github.com/owner/repository";
    if (name.trim().length > 80) v.name = "Project name must be at most 80 characters";
    setErrors(v);
    if (Object.keys(v).length) return;

    setBusy(true);
    try {
      const project = await projectsApi.import({ url: url.trim(), name: name.trim() });
      notifyProjectsChanged();
      toast.success(`Imported ${project.repoOwner}/${project.repoName} as "${project.name}"`);
      onDone?.();
      navigate(`/app/projects/${project.id}`);
    } catch (err) {
      if (err.apiCode === "already_imported") {
        setExistingId(err.response?.data?.error?.details?.projectId || null);
        setFormError(err.friendly);
      } else {
        const fe = err.fieldErrors || {};
        const mapped = {};
        if (fe.url?.[0]) mapped.url = fe.url[0];
        if (fe.name?.[0]) mapped.name = fe.name[0];
        setErrors(mapped);
        if (!Object.keys(mapped).length) setFormError(err.friendly);
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}{" "}
          {existingId && <Link to={`/app/projects/${existingId}`} onClick={onDone} className="font-medium underline">Open it</Link>}
        </div>
      )}
      <FormField label="GitHub repository URL" id="repo-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} error={errors.url} placeholder="https://github.com/owner/repository" disabled={busy} autoComplete="off" />
      <FormField label="Project name (optional)" id="project-name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Leave blank to use “Project N”" hint="You can rename it any time. This never changes the repository on GitHub." disabled={busy} />
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Github size={16} />}
        {busy ? "Fetching repository details from GitHub…" : "Import repository"}
      </button>
    </form>
  );
}
