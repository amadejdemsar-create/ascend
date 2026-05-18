/**
 * `ascend context search "<query>"` — search context entries.
 *
 * Calls GET /api/context/search?q=...&mode=hybrid|text|semantic&limit=N.
 * Pretty output: per-row title + 2-line snippet + match-via badge
 * (text/semantic/both) + score.
 *
 * Flags:
 *   --mode <m>   hybrid (default) | text | semantic
 *   --limit <n>  Max results (default 20, server caps at 100).
 *   --json / --md
 */

import { Command } from "commander";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import { CliUsageError } from "../../errors.js";
import {
  renderList,
  resolveOutputMode,
  truncate,
} from "../../lib/output.js";

type SearchMode = "text" | "semantic" | "hybrid";

interface SearchHit {
  id: string;
  title: string;
  content: string;
  tags: string[];
  type: string;
  isPinned: boolean;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
  score: number;
  matchedVia: "text" | "semantic" | "both";
}

interface SearchOpts {
  mode?: string;
  limit?: string;
  json?: boolean;
  md?: boolean;
}

const VALID_MODES = new Set<SearchMode>(["text", "semantic", "hybrid"]);

export function buildContextSearchCommand(parent: Command): Command {
  return new Command("search")
    .description("Search context entries by text + semantic similarity.")
    .argument("<query>", "Search query string (1-500 chars).")
    .option("--mode <m>", "text, semantic, or hybrid (default hybrid).")
    .option("--limit <n>", "Max results (default 20, max 100).")
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (query: string, opts: SearchOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      const mode = (opts.mode ?? "hybrid").toLowerCase();
      if (!VALID_MODES.has(mode as SearchMode)) {
        throw new CliUsageError(
          `Invalid --mode "${opts.mode}". Use text, semantic, or hybrid.`,
          "mode",
        );
      }

      const qs = new URLSearchParams({ q: query, mode });
      if (opts.limit) qs.set("limit", opts.limit);

      const hits = await client.get<SearchHit[]>(
        `/api/context/search?${qs.toString()}`,
      );

      renderList({
        mode: resolveOutputMode(opts),
        rows: hits,
        mdTitle: `Search: ${query}`,
        mdLine: (h) =>
          `- **${h.title}** _(${h.matchedVia}, ${h.score.toFixed(2)})_ · id=${h.id}\n  > ${snippet(h.content, 200)}`,
        pretty: (rows) => {
          if (rows.length === 0) {
            return pc.dim(`No matches for "${query}".`);
          }
          const blocks: string[] = [];
          for (const h of rows) {
            const badge = pc.dim(`(${h.matchedVia}, ${h.score.toFixed(2)})`);
            const idTag = pc.dim(`id=${h.id.slice(0, 8)}`);
            const header = `${pc.bold(truncate(h.title, 80))} ${badge} ${idTag}`;
            const body = pc.dim(snippet(h.content, 200));
            blocks.push(`${header}\n  ${body}`);
          }
          const footer = pc.dim(
            `\n${rows.length} hit${rows.length === 1 ? "" : "s"} for "${truncate(query, 60)}"`,
          );
          return `${blocks.join("\n\n")}${footer}`;
        },
      });
    });
}

function snippet(content: string, max: number): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
}
