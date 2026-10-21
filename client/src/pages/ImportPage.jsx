import ImportForm from "../features/repositories/ImportForm.jsx";

export default function ImportPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Import Repository</h1>
      <p className="mt-1 text-sm text-muted">Paste a public GitHub repository. Each repository becomes exactly one saved project.</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="card p-6 lg:col-span-3"><ImportForm /></div>
        <div className="card self-start p-6 text-sm text-muted lg:col-span-2">
          <h2 className="font-medium text-ink">What happens on import</h2>
          <ul className="mt-3 list-inside list-disc space-y-1.5">
            <li>CodeMate checks the repository is public and reads its details from GitHub.</li>
            <li>It records the default branch and the exact commit imported.</li>
            <li>A new project is saved. Your existing projects are never overwritten.</li>
          </ul>
          <p className="mt-3 text-xs">Source code is never executed and dependencies are never installed. Source analysis arrives in the next phases.</p>
        </div>
      </div>
    </div>
  );
}
