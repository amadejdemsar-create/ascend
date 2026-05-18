/**
 * `ascend calendar day [--date <date>]` — render a single day.
 *
 * Calls /api/todos/by-date + /api/goals/by-deadline-range in parallel
 * for the given day (default: today). Renders an hourly timeline plus
 * an all-day list for entries without a specific time.
 */

import { Command } from "commander";
import { format, parseISO } from "date-fns";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import {
  parseDateInput,
  renderRecord,
  resolveOutputMode,
  statusIcon,
  truncate,
} from "../../lib/output.js";

interface TodoLite {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  scheduledDate: string | null;
}

interface GoalLite {
  id: string;
  title: string;
  horizon: string;
  status: string;
  deadline: string | null;
}

interface DayOpts {
  date?: string;
  json?: boolean;
  md?: boolean;
}

interface DayPayload {
  date: string;
  todos: TodoLite[];
  goals: GoalLite[];
}

export function buildCalendarDayCommand(parent: Command): Command {
  return new Command("day")
    .description("Show one day's todos + goal deadlines.")
    .option(
      "--date <date>",
      'YYYY-MM-DD, "today", "tomorrow", or ISO datetime. Default: today.',
    )
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (opts: DayOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      const { date } = opts.date
        ? parseDateInput(opts.date, "date")
        : { date: new Date() };
      const ymd = format(date, "yyyy-MM-dd");
      const start = `${ymd}T00:00:00.000Z`;
      const end = `${ymd}T23:59:59.999Z`;

      const [todos, goals] = await Promise.all([
        client.get<TodoLite[]>(`/api/todos/by-date?date=${ymd}`),
        client.get<GoalLite[]>(
          `/api/goals/by-deadline-range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        ),
      ]);

      const payload: DayPayload = { date: ymd, todos, goals };

      renderRecord({
        mode: resolveOutputMode(opts),
        row: payload,
        pretty: prettyDay,
        md: mdDay,
      });
    });
}

function prettyDay(p: DayPayload): string {
  const lines: string[] = [];
  const heading = pc.bold(
    `${format(parseISO(`${p.date}T00:00:00Z`), "EEEE, d MMM yyyy")}`,
  );
  lines.push(heading);
  lines.push("");

  // Group by hour for items with a dueDate; collect "all-day" separately.
  const buckets = new Map<number, Array<{ kind: "todo" | "goal"; title: string; status: string }>>();
  const allDay: Array<{ kind: "todo" | "goal"; title: string; status: string }> = [];

  for (const t of p.todos) {
    const ts = t.dueDate ?? t.scheduledDate;
    if (!ts) {
      allDay.push({ kind: "todo", title: t.title, status: t.status });
      continue;
    }
    const hour = parseISO(ts).getHours();
    const bucket = buckets.get(hour) ?? [];
    bucket.push({ kind: "todo", title: t.title, status: t.status });
    buckets.set(hour, bucket);
  }
  for (const g of p.goals) {
    if (!g.deadline) continue;
    const hour = parseISO(g.deadline).getHours();
    const bucket = buckets.get(hour) ?? [];
    bucket.push({ kind: "goal", title: g.title, status: g.status });
    buckets.set(hour, bucket);
  }

  if (allDay.length > 0) {
    lines.push(pc.dim("all day"));
    for (const item of allDay) {
      const glyph = item.kind === "todo" ? statusIcon(item.status) : pc.cyan("◇");
      lines.push(`  ${glyph} ${truncate(item.title, 70)}`);
    }
    lines.push("");
  }

  if (buckets.size === 0 && allDay.length === 0) {
    lines.push(pc.dim("Nothing scheduled."));
    return lines.join("\n");
  }

  const sortedHours = Array.from(buckets.keys()).sort((a, b) => a - b);
  for (const hour of sortedHours) {
    const label = `${hour.toString().padStart(2, "0")}:00`;
    const items = buckets.get(hour)!;
    items.forEach((item, i) => {
      const glyph = item.kind === "todo" ? statusIcon(item.status) : pc.cyan("◇");
      if (i === 0) {
        lines.push(`${pc.dim(label)}  ${glyph} ${truncate(item.title, 64)}`);
      } else {
        lines.push(`       ${glyph} ${truncate(item.title, 64)}`);
      }
    });
  }
  return lines.join("\n");
}

function mdDay(p: DayPayload): string {
  const out: string[] = [];
  out.push(`# ${format(parseISO(`${p.date}T00:00:00Z`), "EEEE, d MMM yyyy")}`, "");
  if (p.todos.length === 0 && p.goals.length === 0) {
    out.push("_(nothing scheduled)_");
    return out.join("\n");
  }
  if (p.todos.length > 0) {
    out.push("## Todos");
    for (const t of p.todos) {
      out.push(`- [${t.status === "DONE" ? "x" : " "}] ${t.title}`);
    }
    out.push("");
  }
  if (p.goals.length > 0) {
    out.push("## Goal deadlines");
    for (const g of p.goals) {
      out.push(`- **${g.title}** _(${g.horizon.toLowerCase()})_`);
    }
  }
  return out.join("\n");
}
