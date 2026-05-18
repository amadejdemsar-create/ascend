/**
 * `ascend goal list` — list goals with optional filters.
 *
 * Flags:
 *   --horizon <h>   YEARLY | QUARTERLY | MONTHLY | WEEKLY
 *   --status <s>    NOT_STARTED | IN_PROGRESS | COMPLETED | ABANDONED
 *   --priority <p>  LOW | MEDIUM | HIGH
 *   --category <id>
 *   --parent <id>   Filter to children of a specific parent (or "null"
 *                   for top-level only).
 *   --limit <n>     Max rows (default 50).
 *   --json / --md
 *
 * Calls GET /api/goals and renders a borderless table with a unicode
 * progress bar so glance-able status is immediate.
 */

import { Command } from "commander";
import Table from "cli-table3";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import { CliUsageError } from "../../errors.js";
import {
  compactTableChars,
  dueColored,
  progressBar,
  renderList,
  resolveOutputMode,
  statusIcon,
  truncate,
} from "../../lib/output.js";

type Horizon = "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY";
type GoalStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
type Priority = "LOW" | "MEDIUM" | "HIGH";

interface GoalRow {
  id: string;
  title: string;
  status: GoalStatus;
  horizon: Horizon;
  priority: Priority;
  progress: number;
  deadline: string | null;
  parentId: string | null;
  category: { id: string; name: string; color: string } | null;
}

interface ListOpts {
  horizon?: string;
  status?: string;
  priority?: string;
  category?: string;
  parent?: string;
  limit?: string;
  json?: boolean;
  md?: boolean;
}

const VALID_HORIZONS = new Set<Horizon>(["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"]);
const VALID_STATUSES = new Set<GoalStatus>([
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
]);
const VALID_PRIORITIES = new Set<Priority>(["LOW", "MEDIUM", "HIGH"]);

export function buildGoalListCommand(parent: Command): Command {
  return new Command("list")
    .description("List goals with optional filters.")
    .option("--horizon <h>", "Filter: YEARLY, QUARTERLY, MONTHLY, or WEEKLY.")
    .option(
      "--status <s>",
      "Filter: NOT_STARTED, IN_PROGRESS, COMPLETED, or ABANDONED.",
    )
    .option("--priority <p>", "Filter: LOW, MEDIUM, or HIGH.")
    .option("--category <id>", "Filter by category id.")
    .option(
      "--parent <id>",
      'Filter by parent id, or "null" for top-level goals only.',
    )
    .option("--limit <n>", "Max rows to return (default 50).")
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (opts: ListOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      const qs = new URLSearchParams();
      if (opts.horizon) {
        const upper = opts.horizon.toUpperCase();
        if (!VALID_HORIZONS.has(upper as Horizon)) {
          throw new CliUsageError(
            `Invalid --horizon "${opts.horizon}". Use YEARLY, QUARTERLY, MONTHLY, or WEEKLY.`,
            "horizon",
          );
        }
        qs.set("horizon", upper);
      }
      if (opts.status) {
        const upper = opts.status.toUpperCase();
        if (!VALID_STATUSES.has(upper as GoalStatus)) {
          throw new CliUsageError(
            `Invalid --status "${opts.status}". Use NOT_STARTED, IN_PROGRESS, COMPLETED, or ABANDONED.`,
            "status",
          );
        }
        qs.set("status", upper);
      }
      if (opts.priority) {
        const upper = opts.priority.toUpperCase();
        if (!VALID_PRIORITIES.has(upper as Priority)) {
          throw new CliUsageError(
            `Invalid --priority "${opts.priority}". Use LOW, MEDIUM, or HIGH.`,
            "priority",
          );
        }
        qs.set("priority", upper);
      }
      if (opts.category) qs.set("categoryId", opts.category);
      if (opts.parent) qs.set("parentId", opts.parent);

      const path = qs.toString() ? `/api/goals?${qs.toString()}` : "/api/goals";
      const all = await client.get<GoalRow[]>(path);
      const limit = opts.limit ? Number(opts.limit) : 50;
      const rows = Number.isFinite(limit) && limit > 0 ? all.slice(0, limit) : all;

      renderList({
        mode: resolveOutputMode(opts),
        rows,
        mdTitle: "Goals",
        mdLine: (g) =>
          `- [${g.status === "COMPLETED" ? "x" : " "}] **${g.title}** · ${g.horizon.toLowerCase()} · ${g.progress}%${g.deadline ? ` · due ${g.deadline}` : ""} · id=${g.id}`,
        pretty: (goals) => {
          if (goals.length === 0) {
            return pc.dim("No goals match those filters.");
          }
          const table = new Table({
            head: [
              pc.dim(""),
              pc.dim("title"),
              pc.dim("horizon"),
              pc.dim("progress"),
              pc.dim("deadline"),
              pc.dim("id"),
            ],
            chars: { ...compactTableChars },
            style: { "padding-left": 0, "padding-right": 1, border: [], head: [] },
          });
          for (const g of goals) {
            table.push([
              statusIcon(g.status),
              truncate(g.title, 50),
              pc.dim(g.horizon.toLowerCase()),
              progressBar(g.progress, 8),
              dueColored(g.deadline),
              pc.dim(g.id.slice(0, 8)),
            ]);
          }
          const footer = pc.dim(
            `${goals.length} goal${goals.length === 1 ? "" : "s"}${all.length > goals.length ? ` (of ${all.length}, --limit truncated)` : ""}`,
          );
          return `${table.toString()}\n${footer}`;
        },
      });
    });
}
