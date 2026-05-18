/**
 * `ascend context` namespace.
 *
 * Aggregates the 3 context subcommands (search, add, get).
 */

import { Command } from "commander";

import { buildContextSearchCommand } from "./search.js";
import { buildContextAddCommand } from "./add.js";
import { buildContextGetCommand } from "./get.js";

export function registerContextCommands(program: Command): void {
  const context = new Command("context").description(
    "Manage context entries: search, add, get detail.",
  );
  context.addCommand(buildContextSearchCommand(program));
  context.addCommand(buildContextAddCommand(program));
  context.addCommand(buildContextGetCommand(program));
  program.addCommand(context);
}
