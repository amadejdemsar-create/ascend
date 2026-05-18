/**
 * `ascend todo add "<title>"` — create a new todo.
 *
 * Flags:
 *   --due <date>            ISO date or natural date string. "tomorrow",
 *                           "2026-05-20", "2026-05-20T15:00:00Z" all accepted.
 *   --priority <p>          LOW | MEDIUM | HIGH (default MEDIUM, the server's default).
 *   --category <id>         Category id; categories are not enumerated here.
 *   --goal <id>             Goal id to attach this todo to.
 *   --description <text>    Long-form description.
 *   --json / --md           Output format flags.
 *
 * Calls POST /api/todos. Returns the created todo's short id prefix
 * for piping (e.g., `ID=$(ascend todo add "..." --json | jq -r .id)`).
 */

import { Command } from "commander";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import { CliUsageError } from "../../errors.js";
import {
  dueColored,
  renderRecord,
  resolveOutputMode,
  truncate,
} from "../../lib/output.js";

type TodoPriority = "LOW" | "MEDIUM" | "HIGH";

interface AddOpts {
  due?: string;
  priority?: string;
  category?: string;
  goal?: string;
  description?: string;
  json?: boolean;
  md?: boolean;
}

interface CreateTodoBody {
  title: string;
  description?: string;
  priority?: TodoPriority;
  goalId?: string;
  categoryId?: string;
  dueDate?: string; // ISO datetime
}

interface CreatedTodo {
  id: string;
  title: string;
  description: string | null;
  priority: TodoPriority;
  status: string;
  dueDate: string | null;
  scheduledDate: string | null;
  isBig3: boolean;
  goalId: string | null;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);

/**
 * Parse a user-supplied date string into an ISO datetime. Accepts:
 *   - "today" / "tomorrow"
 *   - "YYYY-MM-DD" (interpreted as 17:00 local time for next-day-feel)
 *   - any ISO 8601 datetime
 *
 * Throws CliUsageError on garbage input.
 */
function parseDueDate(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const now = new Date();
  if (trimmed === "today") {
    const d = new Date(now);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }
  if (trimmed === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }
  // YYYY-MM-DD → 17:00 local
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const d = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
      17,
      0,
      0,
      0,
    );
    return d.toISOString();
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new CliUsageError(
      `Invalid --due value "${input}". Use "tomorrow", "2026-05-20", or an ISO 8601 datetime.`,
      "due",
    );
  }
  return parsed.toISOString();
}

export function buildTodoAddCommand(parent: Command): Command {
  return new Command("add")
    .description("Create a new todo.")
    .argument("<title>", "Todo title (required, 1-200 chars).")
    .option("--due <date>", "Due date. \"today\", \"tomorrow\", YYYY-MM-DD, or ISO datetime.")
    .option(
      "--priority <p>",
      "Priority: LOW, MEDIUM, or HIGH. Server default MEDIUM.",
    )
    .option("--category <id>", "Category id to attach this todo to.")
    .option("--goal <id>", "Goal id this todo contributes to.")
    .option("--description <text>", "Optional long-form description.")
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (title: string, opts: AddOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      const body: CreateTodoBody = { title: title.trim() };
      if (opts.description) body.description = opts.description;
      if (opts.category) body.categoryId = opts.category;
      if (opts.goal) body.goalId = opts.goal;
      if (opts.due) body.dueDate = parseDueDate(opts.due);
      if (opts.priority) {
        const upper = opts.priority.toUpperCase();
        if (!VALID_PRIORITIES.has(upper)) {
          throw new CliUsageError(
            `Invalid --priority "${opts.priority}". Use LOW, MEDIUM, or HIGH.`,
            "priority",
          );
        }
        body.priority = upper as TodoPriority;
      }

      const created = await client.post<CreatedTodo>("/api/todos", body);

      renderRecord({
        mode: resolveOutputMode(opts),
        row: created,
        pretty: (t) => {
          const headline = `${pc.green("✓")} Created todo ${pc.bold(truncate(t.title, 60))}`;
          const meta: string[] = [];
          if (t.dueDate) meta.push(`due ${dueColored(t.dueDate)}`);
          meta.push(pc.dim(`#${t.priority.toLowerCase()}`));
          meta.push(pc.dim(`id=${t.id.slice(0, 8)}`));
          return `${headline}\n  ${meta.join("  ")}`;
        },
        md: (t) =>
          `- [ ] **${t.title}** ${t.dueDate ? `· due ${t.dueDate}` : ""} · id=${t.id}`,
      });
    });
}
