#!/usr/bin/env node
/**
 * @ascend/cli — Ascend command-line interface.
 *
 * Single entry point with argv-based lazy namespace loading. The
 * common case (`ascend <namespace> <subcommand>`) loads only the
 * dispatched namespace's module tree, skipping the other ~80% of
 * the bundle. This is the cold-start optimization landed after the
 * v0.1.0 review feedback flagged a 620ms baseline against a 200ms
 * PRD target.
 *
 * How it works:
 *   - The auth commands (login, logout, whoami) + `open` are always
 *     eager. They're cheap (no cli-table3, no date-fns transitively)
 *     and first-run workflows hit them.
 *   - The five domain namespaces (todo, goal, context, calendar, mcp)
 *     plus the `today` headline live behind dynamic imports.
 *   - Before commander parses argv, we inspect argv[0]:
 *       * If it matches a namespace, load ONLY that namespace.
 *       * If it's `--version`/`-v`, load nothing extra (commander
 *         handles the flag and exits before parse-action).
 *       * Otherwise (help, unknown command, no args), load everything
 *         so the help output is complete and "unknown command" errors
 *         can still suggest the right namespace.
 *   - For `ascend dashboard` (alias for `today`), the alias map
 *     resolves it before lookup.
 *
 * Cold-start measurements (Node 22, M-series macOS, warm fs cache):
 *   - `ascend --version`            ~80ms   (no namespace load)
 *   - `ascend today`                ~200ms  (today only)
 *   - `ascend todo list`            ~250ms  (todo only)
 *   - `ascend --help`               ~620ms  (all namespaces eagerly
 *                                            registered, unavoidable
 *                                            because help must list
 *                                            every command)
 *
 * Auth chain (every command):
 *   1. flag (--api-key, --base-url)
 *   2. env var (ASCEND_API_KEY, ASCEND_BASE_URL)
 *   3. ~/.ascend/config.json
 *   4. hardcoded defaults (https://ascend.nativeai.agency)
 *
 * See README.md for the full command reference.
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { wrapUnknown } from "./errors.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerLogoutCommand } from "./commands/logout.js";
import { registerWhoamiCommand } from "./commands/whoami.js";
import { registerOpenCommand } from "./commands/open.js";

// Resolve package.json relative to this compiled file. `import.meta.url`
// is the absolute file URL of dist/cli.js at runtime; package.json lives
// one level up.
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("ascend")
  .description(
    "Ascend command-line interface. Manage goals, todos, context, and federated MCP tools from your terminal.",
  )
  .version(pkg.version, "-v, --version", "Print the CLI version and exit.")
  .option(
    "--api-key <key>",
    "API key for the Ascend account. Overrides ASCEND_API_KEY env var and ~/.ascend/config.json.",
  )
  .option(
    "--base-url <url>",
    "Ascend endpoint. Overrides ASCEND_BASE_URL env var and ~/.ascend/config.json. Defaults to https://ascend.nativeai.agency.",
  );

// Eager: small + always-used commands. These don't pull cli-table3
// or date-fns and add ~5-10ms to cold-start total.
registerLoginCommand(program);
registerLogoutCommand(program);
registerWhoamiCommand(program);
registerOpenCommand(program);

/**
 * Each entry is a dynamic-import loader for one namespace's command
 * builder. The key is the command name as the user types it
 * (argv[0]). Aliases get folded in via `aliasMap` below before
 * lookup.
 *
 * Adding a new namespace: add its loader here AND export the
 * `register*Commands` from the namespace's index.ts.
 */
const namespaceLoaders: Record<string, () => Promise<void>> = {
  today: async () => {
    const { registerTodayCommand } = await import("./commands/today.js");
    registerTodayCommand(program);
  },
  todo: async () => {
    const { registerTodoCommands } = await import("./commands/todo/index.js");
    registerTodoCommands(program);
  },
  goal: async () => {
    const { registerGoalCommands } = await import("./commands/goal/index.js");
    registerGoalCommands(program);
  },
  context: async () => {
    const { registerContextCommands } = await import("./commands/context/index.js");
    registerContextCommands(program);
  },
  calendar: async () => {
    const { registerCalendarCommands } = await import(
      "./commands/calendar/index.js"
    );
    registerCalendarCommands(program);
  },
  mcp: async () => {
    const { registerMcpCommands } = await import("./commands/mcp/index.js");
    registerMcpCommands(program);
  },
};

/**
 * argv-level command aliases. `today` is the canonical name;
 * `dashboard` is the alias commander registers via `.alias("dashboard")`
 * inside today.ts. For lazy loading we have to resolve the alias to
 * its canonical key BEFORE the loader fires (commander hasn't seen
 * the alias registration yet).
 */
const aliasMap: Record<string, string> = {
  dashboard: "today",
};

/**
 * Decide which namespaces to load based on argv.
 *
 * Returns the set of loader keys to invoke. Empty array means
 * "everything" (help / unknown / no args / global flag).
 */
function resolveLoadersFromArgv(argv: string[]): string[] {
  // Skip global flag values to find the first positional token.
  // We only support flags BEFORE the namespace per commander
  // convention, so this loop terminates quickly.
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (!tok) break;
    if (tok === "--version" || tok === "-v") return []; // skip all loads
    if (tok === "--help" || tok === "-h" || tok === "help") {
      // Need everything registered so help shows all namespaces.
      return Object.keys(namespaceLoaders);
    }
    if (tok === "--api-key" || tok === "--base-url") {
      // Skip the flag + its value.
      i += 2;
      continue;
    }
    // First non-flag token is the namespace.
    const canonical = aliasMap[tok] ?? tok;
    if (canonical in namespaceLoaders) return [canonical];
    // Unknown token: load everything so commander can suggest the
    // right command or error cleanly.
    return Object.keys(namespaceLoaders);
  }
  // No positional command: load everything so `ascend` with no args
  // shows the full help.
  return Object.keys(namespaceLoaders);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const toLoad = resolveLoadersFromArgv(argv);
  if (toLoad.length === 1) {
    // Common case: single namespace dispatch.
    await namespaceLoaders[toLoad[0]!]!();
  } else if (toLoad.length > 1) {
    // Help / unknown: load everything in parallel.
    await Promise.all(toLoad.map((key) => namespaceLoaders[key]!()));
  }
  // toLoad.length === 0 means --version/-v: commander handles it
  // without any namespace registration.

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const cliErr = wrapUnknown(err);
  process.stderr.write(`ascend: ${cliErr.message}\n`);
  process.exit(cliErr.exitCode);
});
