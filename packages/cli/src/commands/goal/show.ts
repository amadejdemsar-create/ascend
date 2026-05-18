/**
 * `ascend goal show <id-or-prefix>` — print one goal in detail.
 *
 * Resolves the user-supplied id prefix against the full goal list
 * (filtered to non-COMPLETED by default; pass --include-done to
 * include archived goals). Calls GET /api/goals/<id>. Renders a
 * sectioned layout: header, SMART fields, progress bar, deadline,
 * children count.
 */

import { Command } from "commander";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import {
  dueColored,
  progressBar,
  renderRecord,
  resolveOutputMode,
  statusIcon,
  statusLabel,
} from "../../lib/output.js";
import { resolveIdPrefix } from "../../lib/resolve-id.js";

type Horizon = "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY";
type GoalStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
type Priority = "LOW" | "MEDIUM" | "HIGH";

interface GoalDetail {
  id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  horizon: Horizon;
  priority: Priority;
  progress: number;
  startDate: string | null;
  deadline: string | null;
  specific: string | null;
  measurable: string | null;
  attainable: string | null;
  relevant: string | null;
  timely: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  notes: string | null;
  category: { id: string; name: string; color: string } | null;
  children: Array<{ id: string; title: string; status: GoalStatus }>;
  parent: { id: string; title: string; horizon: Horizon } | null;
  createdAt: string;
  updatedAt: string;
}

interface ShowOpts {
  includeDone?: boolean;
  json?: boolean;
  md?: boolean;
}

export function buildGoalShowCommand(parent: Command): Command {
  return new Command("show")
    .description("Show one goal with full detail.")
    .argument("<id>", "Goal id or unique leading prefix.")
    .option(
      "--include-done",
      "Include COMPLETED/ABANDONED goals in prefix resolution. Default lists active only.",
    )
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (idArg: string, opts: ShowOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      let goal: GoalDetail;
      const trimmed = idArg.trim();
      if (trimmed.length >= 20) {
        goal = await client.get<GoalDetail>(`/api/goals/${trimmed}`);
      } else {
        const candidates = await client.get<Array<{ id: string; status: GoalStatus }>>(
          "/api/goals",
        );
        const filtered = opts.includeDone
          ? candidates
          : candidates.filter(
              (g) => g.status !== "COMPLETED" && g.status !== "ABANDONED",
            );
        const match = resolveIdPrefix({
          query: trimmed,
          candidates: filtered,
          label: "goal",
        });
        goal = await client.get<GoalDetail>(`/api/goals/${match.id}`);
      }

      renderRecord({
        mode: resolveOutputMode(opts),
        row: goal,
        pretty: (g) => prettyGoal(g),
        md: (g) => mdGoal(g),
      });
    });
}

function prettyGoal(g: GoalDetail): string {
  const lines: string[] = [];
  const header = `${statusIcon(g.status)} ${pc.bold(g.title)}`;
  lines.push(header);
  const meta = [
    pc.dim(g.horizon.toLowerCase()),
    pc.dim(`#${g.priority.toLowerCase()}`),
    pc.dim(statusLabel(g.status)),
    g.category ? pc.cyan(g.category.name) : null,
  ].filter((s): s is string => s !== null);
  lines.push(`  ${meta.join("  ")}`);
  lines.push("");
  if (g.description) {
    lines.push(g.description);
    lines.push("");
  }
  lines.push(`${pc.dim("progress")}  ${progressBar(g.progress, 16)}`);
  if (g.deadline) {
    lines.push(`${pc.dim("deadline")}  ${dueColored(g.deadline)}`);
  }
  if (g.startDate) {
    lines.push(`${pc.dim("start   ")}  ${g.startDate.slice(0, 10)}`);
  }
  if (g.targetValue !== null) {
    const current = g.currentValue ?? 0;
    lines.push(
      `${pc.dim("target  ")}  ${current} / ${g.targetValue}${g.unit ? ` ${g.unit}` : ""}`,
    );
  }

  const smartLines: string[] = [];
  if (g.specific) smartLines.push(`  ${pc.dim("S")} ${g.specific}`);
  if (g.measurable) smartLines.push(`  ${pc.dim("M")} ${g.measurable}`);
  if (g.attainable) smartLines.push(`  ${pc.dim("A")} ${g.attainable}`);
  if (g.relevant) smartLines.push(`  ${pc.dim("R")} ${g.relevant}`);
  if (g.timely) smartLines.push(`  ${pc.dim("T")} ${g.timely}`);
  if (smartLines.length > 0) {
    lines.push("");
    lines.push(pc.dim("SMART"));
    lines.push(...smartLines);
  }

  if (g.parent) {
    lines.push("");
    lines.push(`${pc.dim("parent  ")}  ${g.parent.title} (${g.parent.horizon.toLowerCase()})`);
  }
  if (g.children.length > 0) {
    lines.push("");
    lines.push(pc.dim(`children (${g.children.length})`));
    for (const c of g.children.slice(0, 10)) {
      lines.push(`  ${statusIcon(c.status)} ${c.title}`);
    }
    if (g.children.length > 10) {
      lines.push(pc.dim(`  … ${g.children.length - 10} more`));
    }
  }
  lines.push("");
  lines.push(pc.dim(`id=${g.id}`));
  return lines.join("\n");
}

function mdGoal(g: GoalDetail): string {
  const out: string[] = [];
  out.push(`# ${g.title}`, "");
  out.push(
    `**${g.horizon.toLowerCase()}** · ${g.priority.toLowerCase()} · ${statusLabel(g.status)} · ${g.progress}%`,
  );
  if (g.deadline) out.push(`**Deadline:** ${g.deadline}`);
  if (g.description) {
    out.push("", g.description);
  }
  const smart: string[] = [];
  if (g.specific) smart.push(`- **S** ${g.specific}`);
  if (g.measurable) smart.push(`- **M** ${g.measurable}`);
  if (g.attainable) smart.push(`- **A** ${g.attainable}`);
  if (g.relevant) smart.push(`- **R** ${g.relevant}`);
  if (g.timely) smart.push(`- **T** ${g.timely}`);
  if (smart.length > 0) out.push("", "## SMART", ...smart);
  if (g.children.length > 0) {
    out.push("", "## Children");
    for (const c of g.children) {
      out.push(`- [${c.status === "COMPLETED" ? "x" : " "}] ${c.title}`);
    }
  }
  out.push("", `_id: ${g.id}_`);
  return out.join("\n");
}
