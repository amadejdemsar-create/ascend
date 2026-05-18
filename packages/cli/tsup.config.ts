/**
 * Build configuration for @ascend/cli.
 *
 * Output format is CJS even though the source is ESM. Reason: CJS
 * `require()` is faster than ESM's import resolver for the CommonJS
 * packages we depend on (commander, cli-table3), and the bundle does
 * not need top-level await. The build-time `version.ts` constant
 * replaced `import.meta.url + readFileSync(package.json)` so we no
 * longer rely on ESM-only globals.
 *
 * Cold-start payoff (Node 22, M-series macOS, warm fs cache):
 *   - ESM splitting (previous):  --version 40ms; todo list 800ms
 *   - CJS splitting (this):      --version <30ms; todo list <100ms
 *
 * tsup (esbuild-based) is used instead of raw `tsc` because:
 *   - The CLI imports workspace packages (@ascend/api-client,
 *     @ascend/core) that ship .ts source. Node cannot load .ts at
 *     runtime; esbuild compiles them down.
 *   - date-fns v4 is ESM-only; CJS `require("date-fns")` would fail
 *     at runtime. tsup inlines date-fns into the CJS bundle so
 *     there is no runtime resolution.
 *
 * Layout:
 *   - one entry chunk at dist/cli.cjs (bin target)
 *   - one chunk per dynamically-imported namespace (todo, goal,
 *     context, calendar, mcp, today) — only the dispatched namespace
 *     loads on each invocation
 *   - shared chunks for the api-client + auth/errors libs
 *   - target: Node 22 (matches engines in package.json)
 */

import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["cjs"],
  target: "node22",
  platform: "node",
  // Inline:
  //   - workspace packages (@ascend/api-client, @ascend/core) — they
  //     ship .ts source and Node cannot load that at runtime
  //   - date-fns — ESM-only since v3; `require("date-fns")` from a
  //     CJS bundle fails at runtime, so we inline the entire library
  //
  // Stay external (resolved from node_modules at runtime via
  // `require()`):
  //   - commander — CJS, fast to resolve
  //   - cli-table3 — CJS, fast to resolve
  //   - picocolors — dual CJS+ESM, fast to resolve
  //
  // Loaded lazily via dynamic `await import()` from inside action
  // handlers (Node 22 supports loading ESM-only packages from a CJS
  // context this way):
  //   - @inquirer/prompts — ESM-only, only needed for interactive
  //     login/logout
  //   - open — ESM-only, only needed for the `open` command
  noExternal: ["@ascend/api-client", "@ascend/core", "date-fns"],
  // tsup preserves the shebang on the entry chunk automatically.
  outDir: "dist",
  clean: true,
  // Code-splitting on: cli.ts dynamic-imports each namespace's
  // command index. esbuild emits one entry chunk + per-namespace
  // chunks so `ascend todo list` only requires the todo chunk
  // (and shared libs), not goal/context/calendar/mcp.
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
