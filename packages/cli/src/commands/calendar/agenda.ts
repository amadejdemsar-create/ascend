/**
 * `ascend calendar agenda [--days N]` — flat upcoming list.
 *
 * Default window: 7 days from now. Pulls todos via /api/todos/by-range
 * and goals via /api/goals/by-deadline-range, sorts everything by date
 * ascending, prints one row per item.
 */

import { Command } from "commander";
import {
  addDays,
  format,
  isToday,
  isTomorrow,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns";
import Table from "cli-table3";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import { CliUsageError } from "../../errors.js";
import {
  compactTableChars,
  renderList,
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

interface AgendaRow {
  kind: "todo" | "goal";
  id: string;
  title: string;
  status: string;
  when: string; // ISO datetime
  meta: string; // priority / horizon
}

interface AgendaOpts {
  days?: string;
  json?: boolean;
  md?: boolean;
}

export function buildCalendarAgendaCommand(parent: Command): Command {
  return new Command("agenda")
    .description("Show upcoming todos + goal deadlines as a flat list.")
    .option("--days <n>", "Window in days from today (default 7, max 90).")
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (opts: AgendaOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      const days = opts.days ? Number(opts.days) : 7;
      if (!Number.isFinite(days) || days <= 0 || days > 90) {
        throw new CliUsageError(
          `Invalid --days "${opts.days}". Use a positive integer between 1 and 90.`,
          "days",
        );
      }

      const start = startOfDay(new Date());
      const end = addDays(start, days);
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      const [todos, goals] = await Promise.all([
        client.get<TodoLite[]>(
          `/api/todos/by-range?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
        ),
        client.get<GoalLite[]>(
          `/api/goals/by-deadline-range?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
        ),
      ]);

      const rows: AgendaRow[] = [];
      for (const t of todos) {
        const ts = t.dueDate ?? t.scheduledDate;
        if (!ts) continue;
        rows.push({
          kind: "todo",
          id: t.id,
          title: t.title,
          status: t.status,
          when: ts,
          meta: "todo",
        });
      }
      for (const g of goals) {
        if (!g.deadline) continue;
        rows.push({
          kind: "goal",
          id: g.id,
          title: g.title,
          status: g.status,
          when: g.deadline,
          meta: g.horizon.toLowerCase(),
        });
      }
      rows.sort((a, b) => a.when.localeCompare(b.when));

      renderList({
        mode: resolveOutputMode(opts),
        rows,
        mdTitle: `Agenda · next ${days} days`,
        mdLine: (r) =>
          `- [${r.status === "DONE" || r.status === "COMPLETED" ? "x" : " "}] **${r.title}** _(${r.meta})_ · ${dayLabel(r.when)} · id=${r.id}`,
        pretty: (list) => {
          if (list.length === 0) {
            return pc.dim(`Nothing in the next ${days} days.`);
          }
          const table = new Table({
            head: [
              pc.dim("when"),
              pc.dim(""),
              pc.dim("title"),
              pc.dim("kind"),
              pc.dim("id"),
            ],
            chars: { ...compactTableChars },
            style: { "padding-left": 0, "padding-right": 1, border: [], head: [] },
          });
          for (const r of list) {
            const glyph =
              r.kind === "todo" ? statusIcon(r.status) : pc.cyan("◇");
            table.push([
              dayLabel(r.when),
              glyph,
              truncate(r.title, 50),
              pc.dim(r.meta),
              pc.dim(r.id.slice(0, 8)),
            ]);
          }
          return `${table.toString()}\n${pc.dim(`${list.length} item${list.length === 1 ? "" : "s"} · next ${days} days`)}`;
        },
      });
    });
}

function dayLabel(iso: string): string {
  const d = parseISO(iso);
  if (!isValid(d)) return iso;
  if (isToday(d)) return pc.yellow("today");
  if (isTomorrow(d)) return pc.yellow("tomorrow");
  return `${format(d, "EEE d MMM")} ${format(d, "HH:mm")}`;
}
