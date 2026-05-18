/**
 * Shared output helpers for the CLI.
 *
 * Phase 4 introduces the minimum surface needed by the todo commands;
 * Phase 6 expands this into the full output lib with --json + --md
 * normalization across every command.
 *
 * Conventions:
 *   - All writes go to process.stdout (success) or process.stderr (errors).
 *   - Colors auto-disable when stdout is not a TTY OR when NO_COLOR is set.
 *     `picocolors` already respects both, so we can use it without guards.
 *   - Relative dates use `date-fns`'s formatDistanceToNow.
 *   - The pretty/json/md fork lives in command handlers; this lib just
 *     gives them the building blocks.
 */

import { formatDistanceToNow, isPast, isToday, parseISO } from "date-fns";
import pc from "picocolors";

import { CliUsageError } from "../errors.js";

/**
 * Common output-format flag set added to every typed command.
 * Phase 6 will codify these via a commander helper; for now each
 * command attaches them via `.option(...)` and reads from `opts`.
 */
export interface OutputFormatOpts {
  json?: boolean;
  md?: boolean;
}

/**
 * Resolve which output mode to use. Pretty by default; --json wins
 * over --md if both are passed (with a stderr warning).
 */
export type OutputMode = "pretty" | "json" | "md";
export function resolveOutputMode(opts: OutputFormatOpts): OutputMode {
  if (opts.json && opts.md) {
    process.stderr.write(
      `${pc.yellow("warning:")} --json and --md both passed; using --json.\n`,
    );
    return "json";
  }
  if (opts.json) return "json";
  if (opts.md) return "md";
  return "pretty";
}

/** "in 2 days" / "3h ago" / "—" if undefined. */
export function relativeDate(iso: string | null | undefined): string {
  if (!iso) return pc.dim("—");
  try {
    const d = parseISO(iso);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return iso;
  }
}

/**
 * Color-coded status icon for a todo / goal status string. The actual
 * icon set is unicode + colored via picocolors; clients with NO_COLOR
 * see plain text.
 */
export function statusIcon(status: string): string {
  switch (status) {
    case "DONE":
    case "COMPLETED":
      return pc.green("✓");
    case "PENDING":
    case "NOT_STARTED":
      return pc.dim("○");
    case "IN_PROGRESS":
      return pc.yellow("◐");
    case "SKIPPED":
      return pc.dim("·");
    case "ABANDONED":
      return pc.red("✗");
    default:
      return pc.dim("?");
  }
}

/** Friendly label for a todo/goal status. */
export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toLowerCase();
}

/**
 * Color a due date string based on whether it is overdue, due today,
 * or in the future. Returns the colored relative string; "—" when null.
 */
export function dueColored(iso: string | null | undefined): string {
  if (!iso) return pc.dim("—");
  try {
    const d = parseISO(iso);
    const rel = formatDistanceToNow(d, { addSuffix: true });
    if (isToday(d)) return pc.yellow(rel);
    if (isPast(d)) return pc.red(rel);
    return rel;
  } catch {
    return iso;
  }
}

/**
 * Shorten a string with an ellipsis on the right. Used to keep table
 * columns within their width budget.
 */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Print pretty + JSON + markdown for a list of rows. Each row callback
 * is responsible for the pretty representation. The lib renders JSON
 * + MD itself using the raw `rows` array.
 *
 * Markdown shape: one item per line, "- <title>", with subsequent
 * lines indented as a bulleted sublist of fields when `mdFields` is
 * provided.
 */
export function renderList<T>(args: {
  mode: OutputMode;
  rows: T[];
  pretty: (rows: T[]) => string;
  mdTitle?: string;
  mdLine: (row: T) => string;
}): void {
  switch (args.mode) {
    case "json":
      process.stdout.write(`${JSON.stringify(args.rows, null, 2)}\n`);
      return;
    case "md": {
      const out: string[] = [];
      if (args.mdTitle) out.push(`# ${args.mdTitle}`, "");
      for (const row of args.rows) out.push(args.mdLine(row));
      out.push("");
      process.stdout.write(`${out.join("\n")}\n`);
      return;
    }
    case "pretty":
      process.stdout.write(`${args.pretty(args.rows)}\n`);
  }
}

/**
 * Borderless table chars used across all CLI tables. Inlined so each
 * command doesn't redeclare the same 16 keys.
 */
export const compactTableChars = {
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
} as const;

/**
 * Parse a user-supplied date string into a JS Date + ISO string.
 *
 * Accepts:
 *   - "today" / "tomorrow" / "yesterday" — anchored at 17:00 local
 *   - "YYYY-MM-DD" — anchored at 17:00 local
 *   - any ISO 8601 datetime
 *
 * The 17:00 local anchor matches the web app's "scheduled-for-today"
 * convention so a CLI `--due today` shows up at the right slot in the
 * calendar.
 *
 * Throws CliUsageError with the flag name on garbage input.
 */
export function parseDateInput(
  input: string,
  flagName = "date",
): { date: Date; iso: string } {
  const trimmed = input.trim().toLowerCase();
  const now = new Date();
  if (trimmed === "today") {
    const d = new Date(now);
    d.setHours(17, 0, 0, 0);
    return { date: d, iso: d.toISOString() };
  }
  if (trimmed === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return { date: d, iso: d.toISOString() };
  }
  if (trimmed === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(17, 0, 0, 0);
    return { date: d, iso: d.toISOString() };
  }
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
    return { date: d, iso: d.toISOString() };
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new CliUsageError(
      `Invalid --${flagName} value "${input}". Use "today", "tomorrow", "YYYY-MM-DD", or an ISO 8601 datetime.`,
      flagName,
    );
  }
  return { date: parsed, iso: parsed.toISOString() };
}

/**
 * Render a horizontal progress bar with the given percent (0-100). Uses
 * unicode block characters so each cell is one char wide. Width defaults
 * to 10 cells; the percent label is appended outside the bar.
 *
 * Examples (width=10):
 *   0   → ░░░░░░░░░░   0%
 *   45  → ████░░░░░░  45%
 *   100 → ██████████ 100%
 *
 * Colors: green at 100, yellow at 50-99, dim at 0-49. NO_COLOR respected
 * via picocolors.
 */
export function progressBar(percent: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const label = `${clamped}%`.padStart(4);
  const colored =
    clamped === 100 ? pc.green(bar) : clamped >= 50 ? pc.yellow(bar) : pc.dim(bar);
  return `${colored} ${pc.dim(label)}`;
}

/** Single-record render with the same three modes. */
export function renderRecord<T>(args: {
  mode: OutputMode;
  row: T;
  pretty: (row: T) => string;
  md: (row: T) => string;
}): void {
  switch (args.mode) {
    case "json":
      process.stdout.write(`${JSON.stringify(args.row, null, 2)}\n`);
      return;
    case "md":
      process.stdout.write(`${args.md(args.row)}\n`);
      return;
    case "pretty":
      process.stdout.write(`${args.pretty(args.row)}\n`);
  }
}
