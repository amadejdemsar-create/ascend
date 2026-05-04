/**
 * Shared confetti helpers for milestone celebrations.
 *
 * Keeps confetti logic centralized so it can be reused across hooks and
 * components. All helpers respect prefers-reduced-motion and include a
 * cooldown guard to prevent stacking.
 */

import confetti from "canvas-confetti";

// ── Guards ───────────────────────────────────────────────────────────────

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const COOLDOWN_MS = 2000;
let lastFiredAt = 0;

function canFire(): boolean {
  const now = Date.now();
  if (now - lastFiredAt < COOLDOWN_MS) return false;
  lastFiredAt = now;
  return true;
}

// ── Public helpers ───────────────────────────────────────────────────────

/**
 * Gentle confetti burst for database creation. 1.5s duration, moderate
 * particle count, centered origin.
 */
export function fireDatabaseCreatedConfetti(): void {
  if (prefersReducedMotion()) return;
  if (!canFire()) return;

  confetti({
    particleCount: 60,
    spread: 55,
    origin: { y: 0.6 },
    disableForReducedMotion: true,
    ticks: 90,
  });
}

/**
 * Smaller confetti burst for the first row added to a database.
 * Lighter than the database-creation celebration (30 particles, shorter).
 */
export function fireFirstRowConfetti(): void {
  if (prefersReducedMotion()) return;
  if (!canFire()) return;

  confetti({
    particleCount: 30,
    spread: 45,
    origin: { y: 0.6 },
    disableForReducedMotion: true,
    ticks: 60,
  });
}
