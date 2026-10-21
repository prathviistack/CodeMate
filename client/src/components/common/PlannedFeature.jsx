import { Hourglass } from "lucide-react";

// Honest placeholder: states which phase delivers the feature. No fake data.
export default function PlannedFeature({ title, description, phase, icon: Icon = Hourglass }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-elevated text-purple">
          <Icon size={22} />
        </span>
        <h2 className="mt-4 text-lg font-medium">Not built yet</h2>
        <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
        <span className="mt-4 rounded-full border border-border px-3 py-1 text-xs text-muted">Planned for {phase}</span>
      </div>
    </div>
  );
}
