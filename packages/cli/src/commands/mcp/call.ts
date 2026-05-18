/**
 * `ascend mcp call <tool> [args-json]` — invoke any MCP tool by name.
 *
 * Generic escape hatch over the typed commands. Calls `tools/call` over
 * JSON-RPC. Args default to `{}` and may be passed as a JSON object on
 * the CLI argv, OR via --args-file <path>, OR via --stdin.
 *
 * Pretty output: prints `result.content[0].text` if present, falling
 * back to a JSON dump of the full content array. Exits with code 2
 * (ApiCallError) when `result.isError === true`.
 *
 * `--json` mode emits the raw JSON-RPC `result` envelope verbatim so
 * scripts can pipe through jq.
 */

import { Command } from "commander";
import { readFile } from "node:fs/promises";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { ApiCallError, CliUsageError } from "../../errors.js";
import { mcpRpc } from "../../lib/mcp.js";
import { renderRecord, resolveOutputMode } from "../../lib/output.js";

interface McpContentText {
  type: "text";
  text: string;
}

interface McpContentImage {
  type: "image";
  data: string;
  mimeType: string;
}

interface McpContentResource {
  type: "resource";
  resource: { uri: string; mimeType?: string; text?: string };
}

type McpContent = McpContentText | McpContentImage | McpContentResource | Record<string, unknown>;

interface ToolsCallResult {
  content?: McpContent[];
  isError?: boolean;
  // Some servers (Ascend's native handlers) return additional fields
  // alongside the standard content array. Pass them through in --json.
  [extra: string]: unknown;
}

interface CallOpts {
  argsFile?: string;
  stdin?: boolean;
  json?: boolean;
  md?: boolean;
}

export function buildMcpCallCommand(parent: Command): Command {
  return new Command("call")
    .description(
      "Invoke any MCP tool by name. Pass args as inline JSON, --args-file, or --stdin.",
    )
    .argument("<tool>", "Tool name. Federated tools use the slug__name form.")
    .argument(
      "[args]",
      'Inline JSON object of arguments. Default "{}". Use --args-file or --stdin for big payloads.',
    )
    .option(
      "--args-file <path>",
      "Read the arguments JSON from a file (overrides the inline argument).",
    )
    .option(
      "--stdin",
      "Read the arguments JSON from stdin (overrides inline + --args-file).",
    )
    .option("--json", "Output the raw JSON-RPC result envelope.")
    .option("--md", "Output markdown.")
    .action(async (tool: string, argsArg: string | undefined, opts: CallOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });

      const args = await resolveArgs(argsArg, opts);

      const result = await mcpRpc<ToolsCallResult>(auth, "tools/call", {
        name: tool,
        arguments: args,
      });

      renderRecord({
        mode: resolveOutputMode(opts),
        row: result,
        pretty: prettyCall,
        md: mdCall,
      });

      // Exit non-zero on tool-reported errors so shell scripts can chain.
      if (result.isError) {
        const first = result.content?.find(
          (c): c is McpContentText => isTextContent(c),
        );
        throw new ApiCallError({
          status: 200,
          path: "/api/mcp",
          message: first ? first.text : "MCP tool returned isError=true",
        });
      }
    });
}

async function resolveArgs(
  inline: string | undefined,
  opts: CallOpts,
): Promise<Record<string, unknown>> {
  let raw: string | undefined;
  if (opts.stdin) {
    if (process.stdin.isTTY) {
      throw new CliUsageError(
        "--stdin was passed but stdin is a TTY. Pipe JSON into the command.",
        "stdin",
      );
    }
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    raw = Buffer.concat(chunks).toString("utf-8");
  } else if (opts.argsFile) {
    raw = await readFile(opts.argsFile, "utf-8");
  } else if (inline !== undefined) {
    raw = inline;
  }
  if (raw === undefined || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CliUsageError(
        "MCP tool arguments must be a JSON object (not array, not primitive).",
        "args",
      );
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof CliUsageError) throw err;
    throw new CliUsageError(
      `Invalid JSON for tool args: ${err instanceof Error ? err.message : String(err)}`,
      "args",
    );
  }
}

function prettyCall(r: ToolsCallResult): string {
  if (r.isError) {
    const first = r.content?.find((c): c is McpContentText => isTextContent(c));
    return `${pc.red("✗")} ${pc.bold("MCP tool returned an error")}${first ? `\n${first.text}` : ""}`;
  }
  if (!r.content || r.content.length === 0) {
    return pc.dim("(empty result)");
  }
  const parts: string[] = [];
  for (const c of r.content) {
    if (isTextContent(c)) {
      parts.push(c.text);
    } else if ("type" in c && c.type === "image") {
      const img = c as McpContentImage;
      parts.push(pc.dim(`[image ${img.mimeType}, ${img.data.length} chars base64]`));
    } else if ("type" in c && c.type === "resource") {
      const res = c as McpContentResource;
      parts.push(pc.dim(`[resource ${res.resource.uri}]`));
      if (res.resource.text) parts.push(res.resource.text);
    } else {
      parts.push(JSON.stringify(c, null, 2));
    }
  }
  return parts.join("\n\n");
}

function mdCall(r: ToolsCallResult): string {
  if (r.isError) {
    const first = r.content?.find((c): c is McpContentText => isTextContent(c));
    return `> **Error:** MCP tool failed${first ? `\n>\n> ${first.text.replace(/\n/g, "\n> ")}` : ""}`;
  }
  if (!r.content || r.content.length === 0) return "_(empty result)_";
  const parts: string[] = [];
  for (const c of r.content) {
    if (isTextContent(c)) parts.push("```\n" + c.text + "\n```");
    else parts.push("```json\n" + JSON.stringify(c, null, 2) + "\n```");
  }
  return parts.join("\n\n");
}

function isTextContent(c: McpContent): c is McpContentText {
  return typeof c === "object" && c !== null && "type" in c && c.type === "text";
}
