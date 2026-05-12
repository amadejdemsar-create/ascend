/**
 * Deterministic color assignment for presence awareness.
 *
 * Maps a userId to a stable HSL color so each user always gets the
 * same cursor/avatar color across sessions and tabs.
 *
 * Uses a djb2 hash on the userId string, then maps to an HSL hue.
 * Saturation and lightness are fixed at values that produce readable
 * colors on both light and dark backgrounds.
 *
 * Pure TypeScript, no dependencies.
 */

/**
 * djb2 hash function. Fast, deterministic, good distribution
 * for short alphanumeric strings like CUIDs.
 */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to positive 32-bit integer
  return hash >>> 0;
}

/**
 * Returns a deterministic HSL color string for a given userId.
 *
 * The hue is derived from the hash of the userId. Saturation is
 * fixed at 70% and lightness at 55% for WCAG AA contrast against
 * white backgrounds while remaining vibrant enough to be visually
 * distinct.
 */
export function getUserColor(userId: string): string {
  const hash = djb2(userId);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 55%)`;
}
