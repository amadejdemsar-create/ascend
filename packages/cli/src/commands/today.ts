/**
 * `ascend today` — morning dashboard in 4 sections.
 *
 * 1. Big 3 — today's three priorities, status icon prefix.
 * 2. Today's agenda — todos due today + goals deadlining today.
 * 3. Weekly focus — top 5 weekly-horizon goals (from /api/dashboard).
 * 4. Streaks + XP — current streak, weekly score, total XP, level.
 *
 * Calls /api/dashboard + /api/todos/big3 + /api/todos/by-date + the
 * goals/by-deadline-range route in parallel so the command finishes
 * in one network roundtrip.
 */

import { Command } from "commander";
import { format } from "date-fns";
import pc from "picocolors";

import { resolveAuth } from "../auth.js";
import { makeClient } from "../client.js";
import {
  dueColored,
  progressBar,
  renderRecord,
  resolveOutputMode,
  statusIcon,
  truncate,
} from "../lib/output.js";

interface DashboardData {
  weeklyFocus: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    progress: number;
    deadline: string | null;
  }>;
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    horizon: string;
    deadline: string;
  }>;
  streaksStats: {
    completedThisMonth: number;
    currentStreak: number;
    longestStreak: number;
    weeklyScore: number;
    currentXp: number;
    level: number;
    xpToNext: { current: number; needed: number; percentage: number };
  };
}

interface TodoLite {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  isBig3: boolean;
}

interface GoalLite {
  id: string;
  title: string;
  horizon: string;
  status: string;
  deadline: string | null;
}

interface TodayOpts {
  json?: boolean;
  md?: boolean;
}

interface TodayPayload {
  date: string;
  big3: TodoLite[];
  agendaTodos: TodoLite[];
  agendaGoals: GoalLite[];
  dashboard: DashboardData;
}

export function registerTodayCommand(program: Command): void {
  program
    .command("today")
    .alias("dashboard")
    .description(
      "Morning dashboard: Big 3, today's agenda, weekly focus, streaks + XP.",
    )
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (opts: TodayOpts) => {
      const parent = program.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parent.apiKey,
        flagBaseUrl: parent.baseUrl,
      });
      const client = makeClient(auth);

      const todayIso = format(new Date(), "yyyy-MM-dd");
      const startOfDay = `${todayIso}T00:00:00.000Z`;
      const endOfDay = `${todayIso}T23:59:59.999Z`;

      const [dashboard, big3, agendaTodos, agendaGoals] = await Promise.all([
        client.get<DashboardData>("/api/dashboard"),
        client.get<TodoLite[]>("/api/todos/big3"),
        client.get<TodoLite[]>(`/api/todos/by-date?date=${todayIso}`),
        client.get<GoalLite[]>(
          `/api/goals/by-deadline-range?start=${encodeURIComponent(startOfDay)}&end=${encodeURIComponent(endOfDay)}`,
        ),
      ]);

      const payload: TodayPayload = {
        date: todayIso,
        big3,
        agendaTodos,
        agendaGoals,
        dashboard,
      };

      renderRecord({
        mode: resolveOutputMode(opts),
        row: payload,
        pretty: prettyToday,
        md: mdToday,
      });
    });
}

function prettyToday(p: TodayPayload): string {
  const sections: string[] = [];
  const heading = `${pc.bold(`Today · ${format(new Date(p.date), "EEE, d MMM yyyy")}`)}`;
  sections.push(heading);

  // Big 3
  sections.push("");
  sections.push(pc.dim("Big 3"));
  if (p.big3.length === 0) {
    sections.push(
      pc.dim("  No Big 3 set. Run `ascend todo big3 set <id1> [<id2>] [<id3>]`."),
    );
  } else {
    p.big3.forEach((t, i) => {
      sections.push(
        `  ${pc.dim(`${i + 1}.`)} ${statusIcon(t.status)} ${truncate(t.title, 70)}`,
      );
    });
  }

  // Today's agenda
  sections.push("");
  sections.push(pc.dim("Today's agenda"));
  const todoSlice = p.agendaTodos.slice(0, 8);
  const goalSlice = p.agendaGoals.slice(0, 4);
  if (todoSlice.length === 0 && goalSlice.length === 0) {
    sections.push(pc.dim("  Nothing scheduled."));
  } else {
    for (const t of todoSlice) {
      sections.push(
        `  ${statusIcon(t.status)} ${truncate(t.title, 60)}  ${dueColored(t.dueDate)}`,
      );
    }
    for (const g of goalSlice) {
      sections.push(
        `  ${pc.cyan("◇")} ${truncate(g.title, 60)}  ${pc.dim(`${g.horizon.toLowerCase()} deadline`)}`,
      );
    }
    const hidden =
      Math.max(0, p.agendaTodos.length - 8) + Math.max(0, p.agendaGoals.length - 4);
    if (hidden > 0) {
      sections.push(pc.dim(`  … ${hidden} more`));
    }
  }

  // Weekly focus
  sections.push("");
  sections.push(pc.dim("Weekly focus"));
  if (p.dashboard.weeklyFocus.length === 0) {
    sections.push(pc.dim("  No weekly goals."));
  } else {
    for (const g of p.dashboard.weeklyFocus.slice(0, 5)) {
      sections.push(
        `  ${statusIcon(g.status)} ${truncate(g.title, 52).padEnd(52)}  ${progressBar(g.progress, 8)}`,
      );
    }
  }

  // Streaks + XP
  sections.push("");
  sections.push(pc.dim("Streaks + XP"));
  const s = p.dashboard.streaksStats;
  const xp = s.xpToNext;
  sections.push(
    `  ${pc.dim("streak  ")} ${pc.yellow(`${s.currentStreak}🔥`)}  ${pc.dim(`(best ${s.longestStreak})`)}`,
  );
  sections.push(`  ${pc.dim("weekly  ")} ${s.weeklyScore} pts`);
  sections.push(
    `  ${pc.dim("level   ")} ${pc.bold(`L${s.level}`)}  ${progressBar(xp.percentage, 10)}  ${pc.dim(`${xp.current}/${xp.needed} XP`)}`,
  );
  sections.push(`  ${pc.dim("month   ")} ${s.completedThisMonth} goals completed`);

  return sections.join("\n");
}

function mdToday(p: TodayPayload): string {
  const out: string[] = [];
  out.push(`# Today · ${p.date}`, "");
  out.push("## Big 3");
  if (p.big3.length === 0) {
    out.push("_(none)_");
  } else {
    p.big3.forEach((t, i) =>
      out.push(`${i + 1}. [${t.status === "DONE" ? "x" : " "}] ${t.title}`),
    );
  }
  out.push("", "## Agenda");
  if (p.agendaTodos.length === 0 && p.agendaGoals.length === 0) {
    out.push("_(nothing scheduled)_");
  } else {
    for (const t of p.agendaTodos) {
      out.push(`- [${t.status === "DONE" ? "x" : " "}] ${t.title} _(todo)_`);
    }
    for (const g of p.agendaGoals) {
      out.push(`- ${g.title} _(goal deadline, ${g.horizon.toLowerCase()})_`);
    }
  }
  out.push("", "## Weekly focus");
  for (const g of p.dashboard.weeklyFocus.slice(0, 5)) {
    out.push(`- **${g.title}** — ${g.progress}%`);
  }
  const s = p.dashboard.streaksStats;
  out.push("", "## Streaks + XP");
  out.push(`- streak: **${s.currentStreak}** (best ${s.longestStreak})`);
  out.push(`- weekly: **${s.weeklyScore}** pts`);
  out.push(`- level: **L${s.level}** (${s.xpToNext.current}/${s.xpToNext.needed} XP)`);
  out.push(`- this month: **${s.completedThisMonth}** goals completed`);
  return out.join("\n");
}
