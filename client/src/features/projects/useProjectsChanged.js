import { useEffect } from "react";

// Re-run `reload` whenever any project is imported, renamed, archived or deleted.
export function useProjectsChanged(reload) {
  useEffect(() => {
    window.addEventListener("codemate:projects-changed", reload);
    return () => window.removeEventListener("codemate:projects-changed", reload);
  }, [reload]);
}
