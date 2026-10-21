import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Menu, Search, ChevronRight, Plus } from "lucide-react";
import { navItems } from "./Sidebar.jsx";
import AccountMenu from "./AccountMenu.jsx";
import ProjectSelector from "./ProjectSelector.jsx";
import { useImportDialog } from "../../features/repositories/ImportDialogContext.jsx";

function useCrumbs() {
  const { pathname } = useLocation();
  const match = navItems.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  if (!match) return [];
  const crumbs = [{ label: "CodeMate", to: "/app" }];
  if (!match.end) crumbs.push(pathname === match.to ? { label: match.label } : { label: match.label, to: match.to });
  if (match.to === "/app/projects" && pathname !== match.to) crumbs.push({ label: "Workspace" });
  return crumbs;
}

export default function Topbar({ onMenu }) {
  const crumbs = useCrumbs();
  const navigate = useNavigate();
  const importDialog = useImportDialog();
  const [query, setQuery] = useState("");

  function onSearch(e) {
    e.preventDefault();
    navigate(query.trim() ? `/app/projects?q=${encodeURIComponent(query.trim())}` : "/app/projects");
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur">
      <button className="btn-ghost !px-2 lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu size={18} />
      </button>

      <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 whitespace-nowrap text-sm text-muted xl:flex">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={14} />}
            {c.to ? <Link to={c.to} className="hover:text-ink">{c.label}</Link> : <span className="text-ink">{c.label}</span>}
          </span>
        ))}
      </nav>

      <ProjectSelector />

      <form onSubmit={onSearch} className="relative mx-auto w-full max-w-md" role="search">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input !pl-9" placeholder="Search your projects…" aria-label="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} />
      </form>

      <button className="btn-primary !px-3" onClick={importDialog.open} aria-label="Import repository">
        <Plus size={16} /> <span className="hidden sm:inline">Import</span>
      </button>
      <AccountMenu />
    </header>
  );
}
