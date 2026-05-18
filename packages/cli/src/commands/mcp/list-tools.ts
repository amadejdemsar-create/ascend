/**
 * `ascend mcp list-tools` — enumerate every native + federated MCP tool.
 *
 * Calls `tools/list` over JSON-RPC at /api/mcp and renders a borderless
 * 3-column table: name, description trimmed, source (native or
 * federated:<slug>).
 *
 * Flags:
 *   --filter <substring>  Filter rows by case-insensitive substring on
 *                         either name or description.
 *   --json / --md
 */

import { Command } from "commander";
import Table from "cli-table3";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { classifyToolName, mcpRpc } from "../../lib/mcp.js";
import {
  compactTableChars,
  renderList,
  resolveOutputMode,
  truncate,
} from "../../lib/output.js";

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface ToolsListResult {
  tools: McpTool[];
}

interface ListToolsOpts {
  filter?: string;
  json?: boolean;
  md?: boolean;
}

export function buildMcpListToolsCommand(parent: Command): Command {
  return new Command("list-tools")
    .description("List every native + federated MCP tool available to this account.")
    .option(
      "--filter <s>",
      "Case-insensitive substring filter on name + description.",
    )
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (opts: ListToolsOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });

      const { tools } = await mcpRpc<ToolsListResult>(auth, "tools/list");

      const filtered = opts.filter
        ? tools.filter((t) => {
            const needle = opts.filter!.toLowerCase();
            return (
              t.name.toLowerCase().includes(needle) ||
              (t.description ?? "").toLowerCase().includes(needle)
            );
          })
        : tools;

      renderList({
        mode: resolveOutputMode(opts),
        rows: filtered,
        mdTitle: opts.filter
          ? `MCP tools matching "${opts.filter}"`
          : "MCP tools",
        mdLine: (t) => {
          const { source, slug, bare } = classifyToolName(t.name);
          const sourceTag =
            source === "federated" ? ` _(federated:${slug})_` : " _(native)_";
          return `- **${bare}** \`${t.name}\`${sourceTag} — ${t.description ?? ""}`;
        },
        pretty: (rows) => {
          if (rows.length === 0) {
            return pc.dim(
              opts.filter
                ? `No MCP tools match "${opts.filter}".`
                : "No MCP tools available.",
            );
          }
          const table = new Table({
            head: [pc.dim("name"), pc.dim("source"), pc.dim("description")],
            chars: { ...compactTableChars },
            style: { "padding-left": 0, "padding-right": 1, border: [], head: [] },
          });
          let nativeCount = 0;
          let federatedCount = 0;
          for (const t of rows) {
            const { source, slug, bare } = classifyToolName(t.name);
            const sourceCell =
              source === "federated"
                ? pc.cyan(`federated:${slug}`)
                : pc.dim("native");
            if (source === "federated") federatedCount += 1;
            else nativeCount += 1;
            table.push([
              bare,
              sourceCell,
              pc.dim(truncate(t.description ?? "—", 60)),
            ]);
          }
          const footer = pc.dim(
            `${rows.length} tool${rows.length === 1 ? "" : "s"} (${nativeCount} native, ${federatedCount} federated)${tools.length > rows.length ? ` · ${tools.length - rows.length} hidden by --filter` : ""}`,
          );
          return `${table.toString()}\n${footer}`;
        },
      });
    });
}
