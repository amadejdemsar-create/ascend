/**
 * Ascend design system color tokens.
 *
 * OKLCH color values mirroring the CSS custom properties defined in
 * apps/web/app/globals.css (:root and .dark blocks).
 *
 * IMPORTANT: These TS exports and the CSS custom properties in globals.css
 * must be kept in sync. When updating a color here, update the corresponding
 * CSS variable in globals.css, and vice versa.
 *
 * Current consumers:
 *   - apps/web: uses the CSS custom properties via Tailwind v4 @theme.
 *   - Future: apps/mobile, apps/desktop will read these TS exports directly.
 */

/** Semantic color tokens for the light theme (:root in globals.css). */
export const lightColors = {
  background: "oklch(0.985 0 0)",
  foreground: "oklch(0.145 0 0)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.145 0 0)",
  popover: "oklch(1 0 0)",
  popoverForeground: "oklch(0.145 0 0)",
  primary: "oklch(0.453 0.185 264)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.553 0.191 293)",
  secondaryForeground: "oklch(0.985 0 0)",
  muted: "oklch(0.97 0 0)",
  mutedForeground: "oklch(0.556 0 0)",
  accent: "oklch(0.97 0.005 264)",
  accentForeground: "oklch(0.205 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  border: "oklch(0.922 0 0)",
  input: "oklch(0.922 0 0)",
  ring: "oklch(0.453 0.185 264)",
  chart1: "oklch(0.453 0.185 264)",
  chart2: "oklch(0.553 0.191 293)",
  chart3: "oklch(0.577 0.245 27.325)",
  chart4: "oklch(0.87 0 0)",
  chart5: "oklch(0.439 0 0)",
  chart6: "oklch(0.62 0.15 150)",
  sidebar: "oklch(0.975 0 0)",
  sidebarForeground: "oklch(0.145 0 0)",
  sidebarPrimary: "oklch(0.453 0.185 264)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.95 0.005 264)",
  sidebarAccentForeground: "oklch(0.205 0 0)",
  sidebarBorder: "oklch(0.922 0 0)",
  sidebarRing: "oklch(0.453 0.185 264)",
} as const;

/** Semantic color tokens for the dark theme (.dark in globals.css). */
export const darkColors = {
  background: "oklch(0.107 0.005 270)",
  foreground: "oklch(0.93 0 0)",
  card: "oklch(0.133 0.005 270)",
  cardForeground: "oklch(0.93 0 0)",
  popover: "oklch(0.155 0.005 270)",
  popoverForeground: "oklch(0.93 0 0)",
  primary: "oklch(0.553 0.191 293)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.453 0.185 264)",
  secondaryForeground: "oklch(0.985 0 0)",
  muted: "oklch(0.178 0.005 270)",
  mutedForeground: "oklch(0.6 0 0)",
  accent: "oklch(0.178 0.01 264)",
  accentForeground: "oklch(0.93 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  border: "oklch(0.22 0.01 270)",
  input: "oklch(0.22 0.01 270)",
  ring: "oklch(0.553 0.191 293)",
  chart1: "oklch(0.553 0.191 293)",
  chart2: "oklch(0.453 0.185 264)",
  chart3: "oklch(0.577 0.245 27.325)",
  chart4: "oklch(0.6 0 0)",
  chart5: "oklch(0.371 0 0)",
  chart6: "oklch(0.68 0.15 150)",
  sidebar: "oklch(0.12 0.005 270)",
  sidebarForeground: "oklch(0.93 0 0)",
  sidebarPrimary: "oklch(0.553 0.191 293)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.16 0.01 264)",
  sidebarAccentForeground: "oklch(0.93 0 0)",
  sidebarBorder: "oklch(0.22 0.01 270)",
  sidebarRing: "oklch(0.553 0.191 293)",
} as const;

/** Union type of all semantic color token keys. */
export type ColorToken = keyof typeof lightColors;
