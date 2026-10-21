import { useEffect, useRef } from "react";

// Calls fn every `ms` while `active` is true (used to follow a running import).
export function usePollWhile(active, fn, ms = 1500) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}
