/**
 * `ascend mcp` namespace.
 *
 * Aggregates the 2 MCP escape-hatch subcommands (list-tools, call).
 * Native tools have their own typed commands (`ascend goal list`,
 * `ascend todo add`, etc.); these two are for everything else —
 * including federated tools that the typed CLI does not cover.
 */

import { Command } from "commander";

import { buildMcpListToolsCommand } from "./list-tools.js";
import { buildMcpCallCommand } from "./call.js";

export function registerMcpCommands(program: Command): void {
  const mcp = new Command("mcp").description(
    "Generic MCP escape hatch: list every tool, call any tool by name.",
  );
  mcp.addCommand(buildMcpListToolsCommand(program));
  mcp.addCommand(buildMcpCallCommand(program));
  program.addCommand(mcp);
}
