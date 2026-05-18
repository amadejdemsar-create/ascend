#!/usr/bin/env node
/**
 * @ascend/cli — Ascend command-line interface.
 *
 * Single entry point. Lazy-loads command modules so `ascend --help`
 * and `ascend --version` pay the minimum cold-start cost.
 *
 * Resolution chain for every command:
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

// Subcommands land in Phases 3+ via:
//   import { registerTodoCommands } from "./commands/todo/index.js";
//   registerTodoCommands(program);
//
// Phase 1 ships only the version + help scaffolding.

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`ascend: ${message}`);
  process.exit(1);
});
