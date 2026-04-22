/**
 * Ascend design system border radius tokens.
 *
 * Mirrors the @theme inline block in apps/web/app/globals.css.
 * The base radius is 0.625rem (10px). All other radii are computed as
 * multiples of this base.
 *
 * IMPORTANT: These TS exports and the CSS @theme inline --radius-* values
 * must be kept in sync. See packages/ui-tokens/src/colors.ts header for the
 * sync contract.
 */

/** Base radius value in rem. All other radii derive from this. */
export const radiusBase = "0.625rem";

/**
 * Border radius scale.
 *
 * Matches the @theme inline block in globals.css:
 *   --radius-sm: calc(var(--radius) * 0.6)   -> 0.375rem
 *   --radius-md: calc(var(--radius) * 0.8)   -> 0.5rem
 *   --radius-lg: var(--radius)                -> 0.625rem
 *   --radius-xl: calc(var(--radius) * 1.4)   -> 0.875rem
 *   --radius-2xl: calc(var(--radius) * 1.8)  -> 1.125rem
 *   --radius-3xl: calc(var(--radius) * 2.2)  -> 1.375rem
 *   --radius-4xl: calc(var(--radius) * 2.6)  -> 1.625rem
 */
export const radii = {
  none: "0px",
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.625rem",
  xl: "0.875rem",
  "2xl": "1.125rem",
  "3xl": "1.375rem",
  "4xl": "1.625rem",
  full: "9999px",
} as const;

/** Union type of all border radius token keys. */
export type RadiusToken = keyof typeof radii;
