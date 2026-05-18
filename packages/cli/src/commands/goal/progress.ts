/**
 * `ascend goal progress <id-or-prefix> <value>` — log progress on a goal.
 *
 * Calls POST /api/goals/<id>/progress with `{ value, note? }`. The
 * server recomputes the goal's progress %, fires gamification events,
 * and returns the new ProgressLog row. We then fetch the goal once more
 * to show the new % in pretty mode.
 *
 * Flags:
 *   --note <text>   Optional log note.
 *   --json / --md
 */

import { Command } from "commander";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import { CliUsageError } from "../../errors.js";
import {
  progressBar,
  renderRecord,
  resolveOutputMode,
} from "../../lib/output.js";
import { resolveIdPrefix } from "../../lib/resolve-id.js";

interface GoalSummary {
  id: string;
  title: string;
  progress: number;
  status: string;
}

interface ProgressLog {
  id: string;
  goalId: string;
  value: number;
  note: string | null;
  loggedAt: string;
}

interface ProgressOpts {
  note?: string;
  json?: boolean;
  md?: boolean;
}

export function buildGoalProgressCommand(parent: Command): Command {
  return new Command("progress")
    .description("Log progress on a goal.")
    .argument("<id>", "Goal id or unique leading prefix.")
    .argument("<value>", "Progress value to add (positive number).")
    .option("--note <text>", "Optional note attached to this log entry.")
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (idArg: string, valueArg: string, opts: ProgressOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      const value = Number(valueArg);
      if (!Number.isFinite(value) || value <= 0) {
        throw new CliUsageError(
          `Invalid value "${valueArg}". Pass a positive number.`,
          "value",
        );
      }

      const candidates = await client.get<GoalSummary[]>("/api/goals");
      const match = resolveIdPrefix({
        query: idArg,
        candidates: candidates.filter(
          (g) => g.status !== "COMPLETED" && g.status !== "ABANDONED",
        ),
        label: "goal",
      });
      const prevProgress = match.progress;

      const body: { value: number; note?: string } = { value };
      if (opts.note) body.note = opts.note;
      const log = await client.post<ProgressLog>(
        `/api/goals/${match.id}/progress`,
        body,
      );
      const updated = await client.get<GoalSummary>(`/api/goals/${match.id}`);

      renderRecord({
        mode: resolveOutputMode(opts),
        row: { log, goal: updated, previousProgress: prevProgress },
        pretty: ({ goal, previousProgress }) => {
          const delta = goal.progress - previousProgress;
          const arrow = delta >= 0 ? pc.green(`+${delta}`) : pc.red(`${delta}`);
          const lines = [
            `${pc.green("✓")} Progress logged: ${pc.bold(`+${value}`)} on ${pc.bold(goal.title)}`,
            `  ${pc.dim(`${previousProgress}% → ${goal.progress}% (${arrow})`)}`,
            `  ${progressBar(goal.progress, 12)}`,
          ];
          return lines.join("\n");
        },
        md: ({ goal, log }) =>
          `- Logged \`+${value}\` on **${goal.title}** → ${goal.progress}% (log ${log.id})`,
      });
    });
}
