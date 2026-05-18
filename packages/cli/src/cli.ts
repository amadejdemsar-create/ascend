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

import { wrapUnknown } from "./errors.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerLogoutCommand } from "./commands/logout.js";
import { registerWhoamiCommand } from "./commands/whoami.js";

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

// Auth commands (Phase 3).
registerLoginCommand(program);
registerLogoutCommand(program);
registerWhoamiCommand(program);

// Typed domain commands land in Phases 4-6 via:
//   registerTodoCommands(program);
//   registerGoalCommands(program);
//   registerContextCommands(program);
//   etc.

program.parseAsync(process.argv).catch((err: unknown) => {
  const cliErr = wrapUnknown(err);
  process.stderr.write(`ascend: ${cliErr.message}\n`);
  process.exit(cliErr.exitCode);
});
