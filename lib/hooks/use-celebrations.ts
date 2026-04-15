"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Module-level debounce guard. Prevents double-firing when a user toggles a
// goal complete -> reopen -> complete in quick succession; the second burst
// would stack on top of the first and look like a runaway effect.
const CONFETTI_COOLDOWN_MS = 2000;
let lastConfettiAt = 0;

function canFireConfetti(): boolean {
  const now = Date.now();
  if (now - lastConfettiAt < CONFETTI_COOLDOWN_MS) return false;
  lastConfettiAt = now;
  return true;
}

export function useCelebrations() {
  const celebrateGoalComplete = useCallback(
    (horizon: string): { showCheckmark: boolean } => {
      if (prefersReducedMotion()) {
        return { showCheckmark: false };
      }

      const upper = horizon.toUpperCase();

      if (upper === "YEARLY" || upper === "QUARTERLY") {
        if (!canFireConfetti()) {
          return { showCheckmark: false };
        }
        // Big confetti burst for milestone horizons
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          disableForReducedMotion: true,
        });
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 60,
            origin: { y: 0.65 },
            disableForReducedMotion: true,
          });
        }, 200);
        return { showCheckmark: false };
      }

      if (upper === "MONTHLY" || upper === "WEEKLY") {
        // CSS checkmark animation for shorter horizons
        return { showCheckmark: true };
      }

      return { showCheckmark: false };
    },
    [],
  );

  const celebrateLevelUp = useCallback(() => {
    if (prefersReducedMotion()) return;
    if (!canFireConfetti()) return;

    let tick = 0;
    const interval = setInterval(() => {
      const isLeft = tick % 2 === 0;
      confetti({
        particleCount: 50,
        spread: 55,
        origin: { x: isLeft ? 0 : 1, y: 0.5 },
        angle: isLeft ? 60 : 120,
        disableForReducedMotion: true,
      });
      tick++;
      if (tick >= 12) {
        clearInterval(interval);
      }
    }, 250);
  }, []);

  return { celebrateGoalComplete, celebrateLevelUp };
}
