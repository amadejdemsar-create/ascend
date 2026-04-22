/**
 * Ascend design system typography tokens.
 *
 * Font families mirror the @theme inline block in apps/web/app/globals.css.
 * Font size scale mirrors Tailwind CSS v4 defaults (no custom overrides in globals.css).
 *
 * IMPORTANT: These TS exports and the CSS @theme inline font-family values
 * must be kept in sync. See packages/ui-tokens/src/colors.ts header for the
 * sync contract.
 */

/**
 * Font family stacks.
 *
 * In the web app, these resolve to CSS custom properties:
 *   --font-sans  -> var(--font-inter)
 *   --font-serif -> var(--font-playfair)
 *   --font-mono  -> var(--font-jetbrains)
 *
 * Non-web platforms should map these to the closest available font on their
 * platform (e.g., Inter for sans, Playfair Display for serif, JetBrains Mono
 * for mono).
 */
export const fontFamilies = {
  sans: "Inter, ui-sans-serif, system-ui, sans-serif",
  serif: "Playfair Display, ui-serif, Georgia, serif",
  mono: "JetBrains Mono, ui-monospace, Menlo, monospace",
} as const;

/**
 * Font size scale with associated line heights.
 *
 * Mirrors Tailwind CSS v4 default type scale. Values are [fontSize, lineHeight]
 * tuples as rem strings.
 */
export const fontSizes = {
  xs: { fontSize: "0.75rem", lineHeight: "1rem" },
  sm: { fontSize: "0.875rem", lineHeight: "1.25rem" },
  base: { fontSize: "1rem", lineHeight: "1.5rem" },
  lg: { fontSize: "1.125rem", lineHeight: "1.75rem" },
  xl: { fontSize: "1.25rem", lineHeight: "1.75rem" },
  "2xl": { fontSize: "1.5rem", lineHeight: "2rem" },
  "3xl": { fontSize: "1.875rem", lineHeight: "2.25rem" },
  "4xl": { fontSize: "2.25rem", lineHeight: "2.5rem" },
  "5xl": { fontSize: "3rem", lineHeight: "1" },
  "6xl": { fontSize: "3.75rem", lineHeight: "1" },
} as const;

/**
 * Font weight scale.
 */
export const fontWeights = {
  thin: "100",
  extralight: "200",
  light: "300",
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
} as const;

/**
 * Combined typography export for convenience.
 */
export const typography = {
  families: fontFamilies,
  sizes: fontSizes,
  weights: fontWeights,
} as const;
