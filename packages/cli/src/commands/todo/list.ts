/**
 * `ascend todo list` — list todos with filters.
 *
 * Flags:
 *   --status <s>   PENDING | DONE | SKIPPED
 *   --priority <p> LOW | MEDIUM | HIGH
 *   --category <id>
 *   --goal <id>
 *   --big3         Show only today's Big 3
 *   --limit <n>    Max rows (default 50)
 *   --json / --md  Output flags
 *
 * Calls GET /api/todos with the filter query params, then renders a
 * pretty table with status icon, title, priority, due (color-coded),
 * and 8-char id prefix.
 */

import { Command } from "commander";
import Table from "cli-table3";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import { CliUsageError } from "../../errors.js";
import {
  dueColored,
  renderList,
  resolveOutputMode,
  statusIcon,
  truncate,
} from "../../lib/output.js";

type TodoStatus = "PENDING" | "DONE" | "SKIPPED";
type TodoPriority = "LOW" | "MEDIUM" | "HIGH";

interface TodoRow {
  id: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string | null;
  scheduledDate: string | null;
  isBig3: boolean;
  categoryId: string | null;
  goalId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListOpts {
  status?: string;
  priority?: string;
  category?: string;
  goal?: string;
  big3?: boolean;
  limit?: string;
  json?: boolean;
  md?: boolean;
}

const VALID_STATUSES = new Set<TodoStatus>(["PENDING", "DONE", "SKIPPED"]);
const VALID_PRIORITIES = new Set<TodoPriority>(["LOW", "MEDIUM", "HIGH"]);

export function buildTodoListCommand(parent: Command): Command {
  return new Command("list")
    .description("List todos with optional filters.")
    .option("--status <s>", "Filter by status: PENDING, DONE, or SKIPPED.")
    .option("--priority <p>", "Filter by priority: LOW, MEDIUM, or HIGH.")
    .option("--category <id>", "Filter by category id.")
    .option("--goal <id>", "Filter by goal id.")
    .option("--big3", "Show only today's Big 3.")
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
      if (opts.status) {
        const upper = opts.status.toUpperCase();
        if (!VALID_STATUSES.has(upper as TodoStatus)) {
          throw new CliUsageError(
            `Invalid --status "${opts.status}". Use PENDING, DONE, or SKIPPED.`,
            "status",
          );
        }
        qs.set("status", upper);
      }
      if (opts.priority) {
        const upper = opts.priority.toUpperCase();
        if (!VALID_PRIORITIES.has(upper as TodoPriority)) {
          throw new CliUsageError(
            `Invalid --priority "${opts.priority}". Use LOW, MEDIUM, or HIGH.`,
            "priority",
          );
        }
        qs.set("priority", upper);
      }
      if (opts.category) qs.set("categoryId", opts.category);
      if (opts.goal) qs.set("goalId", opts.goal);
      if (opts.big3) qs.set("isBig3", "true");

      const path = qs.toString()
        ? `/api/todos?${qs.toString()}`
        : "/api/todos";
      const all = await client.get<TodoRow[]>(path);
      const limit = opts.limit ? Number(opts.limit) : 50;
      const rows = Number.isFinite(limit) && limit > 0 ? all.slice(0, limit) : all;

      renderList({
        mode: resolveOutputMode(opts),
        rows,
        mdTitle: "Todos",
        mdLine: (t) =>
          `- [${t.status === "DONE" ? "x" : " "}] ${t.title}${t.dueDate ? ` · due ${t.dueDate}` : ""} · id=${t.id}`,
        pretty: (todos) => {
          if (todos.length === 0) {
            return pc.dim("No todos match those filters.");
          }
          const table = new Table({
            head: [
              pc.dim(""),
              pc.dim("title"),
              pc.dim("priority"),
              pc.dim("due"),
              pc.dim("id"),
            ],
            chars: {
              top: "",
              "top-mid": "",
              "top-left": "",
              "top-right": "",
              bottom: "",
              "bottom-mid": "",
              "bottom-left": "",
              "bottom-right": "",
              left: "",
              "left-mid": "",
              mid: "",
              "mid-mid": "",
              right: "",
              "right-mid": "",
              middle: " ",
            },
            style: { "padding-left": 0, "padding-right": 1, border: [], head: [] },
          });
          for (const t of todos) {
            const titleCell = t.isBig3
              ? `${pc.yellow("★")} ${truncate(t.title, 58)}`
              : truncate(t.title, 60);
            table.push([
              statusIcon(t.status),
              titleCell,
              pc.dim(t.priority.toLowerCase()),
              dueColored(t.dueDate),
              pc.dim(t.id.slice(0, 8)),
            ]);
          }
          const footer = pc.dim(
            `${todos.length} todo${todos.length === 1 ? "" : "s"}${all.length > todos.length ? ` (of ${all.length}, --limit truncated)` : ""}`,
          );
          return `${table.toString()}\n${footer}`;
        },
      });
    });
}
