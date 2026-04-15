"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Animates a number from its previous value to a new target using ease-out cubic easing.
 * Respects prefers-reduced-motion by setting the value instantly when enabled.
 */
export function useAnimatedCounter(
  target: number,
  duration: number = 600
): number {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === 0) {
      setCurrent(0);
      prevTarget.current = 0;
      return;
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setCurrent(target);
      prevTarget.current = target;
      return;
    }

    const from = prevTarget.current;
    const delta = target - from;

    // Skip the animation entirely when there is no delta. Without this the
    // counter would re-run a 600ms ease on every re-render that produces the
    // same target (e.g. the XP bar on dashboard refetch with unchanged XP).
    if (delta === 0) {
      setCurrent(target);
      prevTarget.current = target;
      return;
    }

    const start = performance.now();
    let rafId: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(from + delta * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    prevTarget.current = target;

    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return current;
}
