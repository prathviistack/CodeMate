import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const styles = {
  success: { icon: CheckCircle2, color: "text-success" },
  error: { icon: AlertTriangle, color: "text-danger" },
  info: { icon: Info, color: "text-teal" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message) => {
      const id = crypto.randomUUID();
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const { icon: Icon, color } = styles[t.type];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex animate-pop items-start gap-3 rounded-lg border border-border bg-elevated p-3 shadow-lg"
              role="status"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} />
              <p className="flex-1 text-sm">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
