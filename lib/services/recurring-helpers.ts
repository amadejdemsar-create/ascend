/**
 * Shared recurring-template helpers used by both goal and todo
 * recurring services. The two services are intentionally separate
 * because their date math differs (goals use enum frequency + interval,
 * todos use RFC 5545 rrule strings), but their streak bookkeeping is
 * identical and lives here.
 */

export interface StreakPair {
  currentStreak: number;
  longestStreak: number;
}

/**
 * Increment currentStreak and raise longestStreak if the new value
 * crosses its high-water mark. Returns the new pair; callers then
 * write both fields to the template row.
 */
export function bumpStreak(pair: StreakPair): StreakPair {
  const currentStreak = pair.currentStreak + 1;
  const longestStreak = Math.max(pair.longestStreak, currentStreak);
  return { currentStreak, longestStreak };
}

/**
 * Decrement currentStreak, clamped to zero, without touching
 * longestStreak (high-water mark must never decrease). Used by the
 * uncomplete inverse.
 */
export function clampStreakDown(currentStreak: number): number {
  return Math.max(0, currentStreak - 1);
}
