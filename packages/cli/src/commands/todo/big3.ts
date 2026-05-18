/**
 * `ascend todo big3` — show today's Big 3 (read-only).
 * `ascend todo big3 set <id1> [<id2>] [<id3>]` — set today's Big 3.
 *
 * Ascend's Big 3 is the 1-3 todos a user picks each day as their
 * priorities. This command surfaces both the read and write paths.
 *
 * Read: GET /api/todos/big3 returns up to 3 todos with isBig3=true
 *       for today (server-side date resolution).
 * Set:  POST /api/todos/big3 with { todoIds: [1-3] } replaces the
 *       Big 3 for today. The server unsets isBig3 on any prior Big 3
 *       todos for the same date.
 */

import { Command } from "commander";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import { CliUsageError } from "../../errors.js";
import { resolveIdPrefix } from "../../lib/resolve-id.js";
import {
  dueColored,
  renderList,
  resolveOutputMode,
  statusIcon,
  truncate,
} from "../../lib/output.js";

interface TodoRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  isBig3: boolean;
}

interface Big3Opts {
  json?: boolean;
  md?: boolean;
}

function buildList(parent: Command): Command {
  return new Command("list")
    .description("Show today's Big 3 (default action when no subcommand).")
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (opts: Big3Opts) => {
      await showBig3(parent, opts);
    });
}

function buildSet(parent: Command): Command {
  return new Command("set")
    .description("Replace today's Big 3 with 1-3 todo ids or prefixes.")
    .argument("<ids...>", "1-3 todo ids (full or prefix).")
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (ids: string[], opts: Big3Opts) => {
      if (ids.length < 1 || ids.length > 3) {
        throw new CliUsageError(
          `Big 3 takes between 1 and 3 todo ids; got ${ids.length}.`,
        );
      }
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      // Resolve each id-or-prefix against the pending todo list.
      const candidates = await client.get<TodoRow[]>(
        "/api/todos?status=PENDING",
      );
      const resolvedIds = ids.map(
        (q) => resolveIdPrefix({ query: q, candidates, label: "todo" }).id,
      );

      const result = await client.post<TodoRow[]>("/api/todos/big3", {
        todoIds: resolvedIds,
      });

      renderList({
        mode: resolveOutputMode(opts),
        rows: result,
        mdTitle: "Today's Big 3",
        mdLine: (t) => `- ${t.isBig3 ? "★ " : ""}**${t.title}** · id=${t.id}`,
        pretty: (rows) => {
          const headline = `${pc.green("✓")} Big 3 set:`;
          const body = rows
            .map((t, i) => `  ${pc.dim(`${i + 1}.`)} ${pc.bold(truncate(t.title, 60))}`)
            .join("\n");
          return `${headline}\n${body}`;
        },
      });
    });
}

async function showBig3(parent: Command, opts: Big3Opts): Promise<void> {
  const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
  const auth = resolveAuth({
    flagApiKey: parentOpts.apiKey,
    flagBaseUrl: parentOpts.baseUrl,
  });
  const client = makeClient(auth);
  const big3 = await client.get<TodoRow[]>("/api/todos/big3");
  renderList({
    mode: resolveOutputMode(opts),
    rows: big3,
    mdTitle: "Today's Big 3",
    mdLine: (t) => `- ${t.status === "DONE" ? "[x] " : "[ ] "}**${t.title}**`,
    pretty: (rows) => {
      if (rows.length === 0) {
        return `${pc.dim("No Big 3 set for today.")}\nRun ${pc.bold(
          "ascend todo big3 set <id1> [<id2>] [<id3>]",
        )} to pick.`;
      }
      const lines = rows.map(
        (t, i) =>
          `${pc.dim(`${i + 1}.`)} ${statusIcon(t.status)} ${pc.bold(
            truncate(t.title, 60),
          )}  ${dueColored(t.dueDate)}`,
      );
      return `${pc.bold("Today's Big 3")}\n${lines.join("\n")}`;
    },
  });
}

export function buildTodoBig3Command(parent: Command): Command {
  const big3 = new Command("big3").description(
    "Show or set today's Big 3 priorities.",
  );

  // Default action when no subcommand: list. `ascend todo big3` alone
  // should print the current Big 3, not the help text.
  big3
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (opts: Big3Opts) => {
      await showBig3(parent, opts);
    });

  big3.addCommand(buildList(parent));
  big3.addCommand(buildSet(parent));
  return big3;
}
