import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { useToast } from "../ui/Toast.jsx";

export default function AccountMenu() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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

  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  async function onLogout() {
    setOpen(false);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (e) {
      toast.error(e.friendly || "Could not log out");
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-purple to-teal text-sm font-semibold text-[#0B0D12] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/60"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-60 animate-pop rounded-xl border border-border bg-elevated p-1.5 shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <div className="my-1 border-t border-border" />
          <Link role="menuitem" to="/app/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-card">
            <Settings size={15} /> Settings
          </Link>
          <button role="menuitem" onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-card">
            <LogOut size={15} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
