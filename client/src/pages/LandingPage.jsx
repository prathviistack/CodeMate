import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Logo from "../components/ui/Logo.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";

export default function LandingPage() {
  const { user } = useAuth();
  return (
    <div className="relative min-h-full overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] animate-gradient opacity-30 blur-3xl"
        style={{
          background: "linear-gradient(120deg, #8B7CFF, #35D6C4, #8B7CFF)",
          backgroundSize: "200% 200%",
          maskImage: "radial-gradient(ellipse at top, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at top, black, transparent 70%)",
        }}
      />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/app" className="btn-primary">Open dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Log in</Link>
              <Link to="/signup" className="btn-primary">Sign up</Link>
            </>
          )}
        </div>
      </header>

      <section className="relative mx-auto max-w-3xl px-6 pb-24 pt-24 text-center">
        <h1 className="animate-fade-up text-5xl font-semibold tracking-tight sm:text-6xl">
          Your codebase, <span className="gradient-text">understood.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl animate-fade-up text-lg text-muted" style={{ animationDelay: "120ms" }}>
          Paste a GitHub repository. CodeMate analyzes it, explains it, and guides you through learning it — one saved project per repository.
        </p>
        <div className="mt-8 flex justify-center gap-3 animate-fade-up" style={{ animationDelay: "220ms" }}>
          <Link to={user ? "/app" : "/signup"} className="btn-primary">
            {user ? "Open dashboard" : "Get started free"} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
