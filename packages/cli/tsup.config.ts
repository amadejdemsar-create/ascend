/**
 * Build configuration for @ascend/cli.
 *
 * tsup (esbuild-based) is used instead of raw `tsc` because the CLI
 * imports from workspace packages (`@ascend/api-client`, `@ascend/core`)
 * that ship .ts source directly. Node's runtime ESM resolver cannot
 * load those .ts files, so we bundle them into `dist/cli.js` along
 * with all transitive dependencies.
 *
 * Layout:
 *   - single ESM entry at dist/cli.js with shebang preserved
 *   - external: node built-ins (handled automatically)
 *   - external: heavy runtime libs that bundle poorly OR that we want
 *     users to share across `npm i -g` installs (none in v1; revisit)
 *   - target: Node 22 (matches engines in package.json)
 */

import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  // Bundle workspace packages + their transitive deps so the published
  // npm tarball is self-contained. `noExternal` is the tsup mechanism
  // to FORCE inclusion of named packages that would otherwise be
  // marked external because they appear in package.json deps.
  // Only the workspace packages are inlined. The third-party deps
  // (commander, cli-table3, date-fns, picocolors, @inquirer/prompts,
  // open) stay external because:
  //   - commander + cli-table3 are CJS packages whose internals call
  //     require("events") etc., which esbuild's ESM-output __require
  //     shim cannot satisfy ("Dynamic require of 'events' is not
  //     supported" at runtime). Documented at
  //     https://github.com/evanw/esbuild/issues/1921.
  //   - @inquirer/prompts is large + only used on prompt paths.
  //   - date-fns is large + tree-shakes poorly when bundled.
  //   - picocolors is tiny enough that the win isn't worth it.
  noExternal: ["@ascend/api-client", "@ascend/core"],
  // tsup preserves the shebang from src/cli.ts automatically in ESM
  // output, so we don't need an explicit `banner` config.
  outDir: "dist",
  clean: true,
  // Code-splitting on: cli.ts dynamic-imports each namespace's
  // command index. esbuild emits one entry chunk + per-namespace
  // chunks so `ascend todo list` only evaluates the todo chunk
  // (and the shared lib chunk), not goal/context/calendar/mcp.
  // The bin shebang stays attached to cli.js.
  splitting: true,
  // Source maps would be useful for end-user bug reports but we keep
  // the tarball small for v1; add `sourcemap: true` if users start
  // reporting stack traces with no line numbers.
  sourcemap: false,
  dts: false,
  // Minification trims unnecessary whitespace + drops dead code.
  // Disabled for v1 so stack traces remain readable; flip to `true`
  // once the CLI surface stabilizes and users care about install size.
  minify: false,
});
