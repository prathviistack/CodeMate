import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { ImportDialogProvider } from "../../features/repositories/ImportDialogContext.jsx";

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <ImportDialogProvider>
    <div className="flex h-full">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative h-full w-64 animate-pop">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <div key={pathname} className="mx-auto max-w-6xl animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </ImportDialogProvider>
  );
}
