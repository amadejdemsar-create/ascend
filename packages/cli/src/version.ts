/**
 * Build-time version constant for the CLI.
 *
 * v0.1.0 used to read this from `package.json` via
 * `readFileSync + fileURLToPath(import.meta.url)`. When we switched
 * the bundle output to CJS for the cold-start win, that path stopped
 * working (CJS does not have `import.meta`, and esbuild's CJS shim
 * for `__filename` produces a path inside the bundled chunk graph
 * rather than the installed package directory).
 *
 * Bumping the version: update this file AND `package.json`. A
 * `pnpm version` hook would automate this, but for v0.1.0 the manual
 * step is documented in the README under "Publishing (maintainers
 * only)".
 */
export const VERSION = "0.1.0";
