import Logo from "../../components/ui/Logo.jsx";

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 animate-gradient opacity-20 blur-3xl"
        style={{ background: "linear-gradient(120deg,#8B7CFF,#35D6C4,#8B7CFF)", backgroundSize: "200% 200%" }}
      />
      <div className="card relative w-full max-w-md animate-pop p-8">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-center text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 text-center text-sm text-muted">{footer}</div>
      </div>
    </div>
  );
}
