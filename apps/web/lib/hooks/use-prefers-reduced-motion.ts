"use client";

import { useEffect, useState } from "react";

/**
 * Returns whether the user's OS has "Reduce motion" enabled.
 * SSR-safe: returns false on the server, updates to the real value after mount.
 * Also reacts to runtime changes (user toggling the OS setting while the
 * app is open).
 *
 * See `docs/design/motion.md` for the motion budget rules and where to use
 * this hook.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
