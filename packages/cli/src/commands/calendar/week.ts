/**
 * `ascend calendar week [--start <date>]` — Monday-first 7-day view.
 *
 * Calls /api/todos/by-range + /api/goals/by-deadline-range for the
 * week's range, then groups items by day. Each day shows up to 3
 * items inline with a "+N more" overflow indicator.
 */

import { Command } from "commander";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import Table from "cli-table3";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import {
  compactTableChars,
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

interface WeekOpts {
  start?: string;
  json?: boolean;
  md?: boolean;
}

interface DayBucket {
  date: string; // yyyy-MM-dd
  todos: TodoLite[];
  goals: GoalLite[];
}

interface WeekPayload {
  weekStart: string;
  days: DayBucket[];
}

const MAX_INLINE = 3;

export function buildCalendarWeekCommand(parent: Command): Command {
  return new Command("week")
    .description("Show a 7-day Monday-first calendar grid.")
    .option(
      "--start <date>",
      'YYYY-MM-DD or "today". Defaults to the Monday of the current week.',
    )
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (opts: WeekOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      const anchor = opts.start ? parseDateInput(opts.start, "start").date : new Date();
      const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 7);

      const startIso = `${format(weekStart, "yyyy-MM-dd")}T00:00:00.000Z`;
      const endIso = `${format(addDays(weekStart, 6), "yyyy-MM-dd")}T23:59:59.999Z`;

      const [todos, goals] = await Promise.all([
        client.get<TodoLite[]>(
          `/api/todos/by-range?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
        ),
        client.get<GoalLite[]>(
          `/api/goals/by-deadline-range?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
        ),
      ]);

      // Bucket per day.
      const days: DayBucket[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        days.push({
          date: format(d, "yyyy-MM-dd"),
          todos: [],
          goals: [],
        });
      }
      for (const t of todos) {
        const ts = t.dueDate ?? t.scheduledDate;
        if (!ts) continue;
        const ymd = format(parseISO(ts), "yyyy-MM-dd");
        const bucket = days.find((d) => d.date === ymd);
        if (bucket) bucket.todos.push(t);
      }
      for (const g of goals) {
        if (!g.deadline) continue;
        const ymd = format(parseISO(g.deadline), "yyyy-MM-dd");
        const bucket = days.find((d) => d.date === ymd);
        if (bucket) bucket.goals.push(g);
      }

      void weekEnd; // for future extensions; weekStart + 6 days is the active range

      const payload: WeekPayload = {
        weekStart: format(weekStart, "yyyy-MM-dd"),
        days,
      };

      renderRecord({
        mode: resolveOutputMode(opts),
        row: payload,
        pretty: prettyWeek,
        md: mdWeek,
      });
    });
}

function prettyWeek(p: WeekPayload): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const table = new Table({
    head: p.days.map((d) => {
      const date = parseISO(`${d.date}T00:00:00Z`);
      const label = `${format(date, "EEE d")}`;
      return d.date === today ? pc.bold(pc.yellow(label)) : pc.dim(label);
    }),
    chars: { ...compactTableChars, middle: " │ " },
    style: { "padding-left": 1, "padding-right": 1, border: [], head: [] },
    colWidths: Array(7).fill(20),
    wordWrap: true,
  });

  const row = p.days.map((d) => {
    const items: string[] = [];
    for (const t of d.todos.slice(0, MAX_INLINE)) {
      items.push(`${statusIcon(t.status)} ${truncate(t.title, 16)}`);
    }
    for (const g of d.goals.slice(0, Math.max(0, MAX_INLINE - d.todos.length))) {
      items.push(`${pc.cyan("◇")} ${truncate(g.title, 16)}`);
    }
    const hidden =
      Math.max(0, d.todos.length - MAX_INLINE) +
      Math.max(0, d.goals.length - Math.max(0, MAX_INLINE - d.todos.length));
    if (hidden > 0) items.push(pc.dim(`+${hidden} more`));
    return items.length > 0 ? items.join("\n") : pc.dim("—");
  });
  table.push(row);

  const heading = pc.bold(
    `Week of ${format(parseISO(`${p.weekStart}T00:00:00Z`), "d MMM yyyy")}`,
  );
  return `${heading}\n${table.toString()}`;
}

function mdWeek(p: WeekPayload): string {
  const out: string[] = [];
  out.push(`# Week of ${p.weekStart}`, "");
  for (const d of p.days) {
    const date = parseISO(`${d.date}T00:00:00Z`);
    out.push(`## ${format(date, "EEEE d MMM")}`);
    if (d.todos.length === 0 && d.goals.length === 0) {
      out.push("_(nothing scheduled)_", "");
      continue;
    }
    for (const t of d.todos) {
      out.push(`- [${t.status === "DONE" ? "x" : " "}] ${t.title}`);
    }
    for (const g of d.goals) {
      out.push(`- **${g.title}** _(goal, ${g.horizon.toLowerCase()})_`);
    }
    out.push("");
  }
  return out.join("\n");
}
