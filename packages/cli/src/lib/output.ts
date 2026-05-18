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
