import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderGit2,
  DownloadCloud,
  FileCode2,
  Route,
  Bot,
  ListChecks,
  TrendingUp,
  Settings,
} from "lucide-react";
import Logo from "../ui/Logo.jsx";

export const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/projects", label: "Projects", icon: FolderGit2 },
  { to: "/app/import", label: "Import Repository", icon: DownloadCloud },
  { to: "/app/explorer", label: "Codebase Explorer", icon: FileCode2 },
  { to: "/app/roadmap", label: "Learning Roadmap", icon: Route },
  { to: "/app/tutor", label: "AI Code Tutor", icon: Bot },
  { to: "/app/quizzes", label: "Quizzes & Practice", icon: ListChecks },
  { to: "/app/progress", label: "Learning Progress", icon: TrendingUp },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ onNavigate }) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-5 py-5">
        <Logo to="/app" />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Main">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                isActive ? "bg-elevated text-ink" : "text-muted hover:bg-elevated/60 hover:text-ink"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-gradient-to-b from-purple to-teal transition-all duration-200 ${
                    isActive ? "opacity-100" : "scale-y-0 opacity-0"
                  }`}
                />
                <Icon size={18} className={isActive ? "text-purple" : ""} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border px-5 py-3 text-xs text-muted">Your codebase, understood.</div>
    </aside>
  );
}
