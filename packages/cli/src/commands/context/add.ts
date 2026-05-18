/**
 * `ascend context add "<title>"` — create a context entry.
 *
 * Markdown body comes from either:
 *   - `--content <body>` flag
 *   - `--stdin` flag (read the entry body from stdin)
 *
 * One of the two is required. Plus optional `--tags`, `--category`,
 * `--type`. Calls POST /api/context with createContextSchema-shaped
 * body.
 */

import { Command } from "commander";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import { CliUsageError } from "../../errors.js";
import {
  renderRecord,
  resolveOutputMode,
  truncate,
} from "../../lib/output.js";

interface CreateContextBody {
  title: string;
  content: string;
  tags?: string[];
  categoryId?: string;
}

interface CreatedEntry {
  id: string;
  title: string;
  type: string;
  tags: string[];
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AddOpts {
  content?: string;
  stdin?: boolean;
  tags?: string;
  category?: string;
  json?: boolean;
  md?: boolean;
}

export function buildContextAddCommand(parent: Command): Command {
  return new Command("add")
    .description("Create a new context entry (note).")
    .argument("<title>", "Entry title (1-200 chars).")
    .option("--content <body>", "Markdown body. Required unless --stdin is passed.")
    .option(
      "--stdin",
      "Read the markdown body from stdin instead of the --content flag.",
    )
    .option(
      "--tags <list>",
      "Comma-separated tags (max 20, each 1-50 chars).",
    )
    .option("--category <id>", "Category id.")
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (title: string, opts: AddOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      let content: string | undefined = opts.content;
      if (opts.stdin) {
        content = await readStdin();
      }
      if (!content || content.trim().length === 0) {
        throw new CliUsageError(
          "Missing entry body. Pass --content <body> or --stdin and pipe text.",
          "content",
        );
      }

      const body: CreateContextBody = { title: title.trim(), content };
      if (opts.tags) {
        body.tags = opts.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
      if (opts.category) body.categoryId = opts.category;

      const created = await client.post<CreatedEntry>("/api/context", body);

      renderRecord({
        mode: resolveOutputMode(opts),
        row: created,
        pretty: (e) => {
          const headline = `${pc.green("✓")} Created ${pc.dim(e.type.toLowerCase())} ${pc.bold(truncate(e.title, 60))}`;
          const meta = [
            pc.dim(`id=${e.id.slice(0, 8)}`),
            e.tags.length > 0 ? pc.cyan(e.tags.map((t) => `#${t}`).join(" ")) : null,
          ].filter((s): s is string => s !== null);
          return `${headline}\n  ${meta.join("  ")}`;
        },
        md: (e) =>
          `- Created **${e.title}** (${e.type.toLowerCase()}) · id=${e.id}${e.tags.length > 0 ? ` · tags: ${e.tags.join(", ")}` : ""}`,
      });
    });
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new CliUsageError(
      "--stdin was passed but stdin is a TTY. Pipe content into the command.",
      "stdin",
    );
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
