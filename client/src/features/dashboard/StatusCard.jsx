import { useEffect, useState } from "react";
import { Server, Database, Sparkles } from "lucide-react";
import { getHealth } from "../../lib/api.js";
import Skeleton from "../../components/ui/Skeleton.jsx";

function Row({ icon: Icon, label, ok, detail }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon size={16} className="text-muted" />
      <span className="flex-1 text-sm">{label}</span>
      <span className={`flex items-center gap-2 text-xs ${ok ? "text-success" : "text-warning"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-success" : "bg-warning"}`} />
        {detail}
      </span>
    </div>
  );
}

export default function StatusCard() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    getHealth()
      .then((data) => setState({ data }))
      .catch((e) => setState({ error: e.friendly }));
  }, []);

  return (
    <div className="card p-5">
      <h2 className="text-sm font-medium">System status</h2>
      {state.loading ? (
        <div className="mt-4 space-y-3"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
      ) : state.error ? (
        <p className="mt-3 text-sm text-danger">Cannot reach the API: {state.error}</p>
      ) : (
        <div className="mt-2 divide-y divide-border">
          <Row icon={Server} label="API server" ok detail="online" />
          <Row icon={Database} label="MongoDB" ok={state.data.database === "connected"} detail={state.data.database} />
          <Row icon={Sparkles} label="AI provider" ok={state.data.ai.configured} detail={state.data.ai.configured ? state.data.ai.provider : "not configured"} />
        </div>
      )}
    </div>
  );
}
