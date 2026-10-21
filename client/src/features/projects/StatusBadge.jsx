const ANALYSIS = {
  pending: { label: "Awaiting analysis", cls: "border-border text-muted", dot: "bg-muted" },
  running: { label: "Analyzing", cls: "border-teal/40 text-teal", dot: "bg-teal animate-pulse" },
  ready: { label: "Analysis ready", cls: "border-success/40 text-success", dot: "bg-success" },
  failed: { label: "Analysis failed", cls: "border-danger/40 text-danger", dot: "bg-danger" },
};
const LEARNING = {
  not_started: { label: "Not started", cls: "border-border text-muted", dot: "bg-muted" },
  in_progress: { label: "Learning", cls: "border-purple/40 text-purple", dot: "bg-purple" },
  completed: { label: "Completed", cls: "border-success/40 text-success", dot: "bg-success" },
};

function Badge({ cfg }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export const AnalysisBadge = ({ status }) => <Badge cfg={ANALYSIS[status] || ANALYSIS.pending} />;
export const LearningBadge = ({ status }) => <Badge cfg={LEARNING[status] || LEARNING.not_started} />;
