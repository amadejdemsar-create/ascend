/**
 * Shared export formatting helpers for CSV and Markdown.
 * Used by both the MCP data tools and the export service.
 */

import { HORIZON_ORDER } from "@/lib/services/import-helpers";

/**
 * Escape a value for CSV output. Wraps in double quotes if the value
 * contains commas, double quotes, or newlines. Internal double quotes
 * are escaped by doubling them.
 */
export function csvEscape(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format goals as CSV with headers.
 */
export function formatCSV(goals: Array<Record<string, unknown>>): string {
  const headers = [
    "id",
    "title",
    "horizon",
    "status",
    "priority",
    "progress",
    "targetValue",
    "currentValue",
    "unit",
    "deadline",
    "categoryId",
    "parentId",
    "createdAt",
  ];
  const rows = goals.map((g) => headers.map((h) => csvEscape(g[h])).join(","));
  return [headers.join(","), ...rows].join("\n");
}

/**
 * Format goals as a Markdown document grouped by horizon.
 */
export function formatMarkdown(goals: Array<Record<string, unknown>>): string {
  const date = new Date().toISOString();
  let md = `# Ascend Goal Export\n\n*Exported: ${date}*\n\n`;

  for (const horizon of HORIZON_ORDER) {
    const filtered = goals.filter((g) => g.horizon === horizon);
    if (filtered.length === 0) continue;
    const label = horizon.charAt(0) + horizon.slice(1).toLowerCase();
    md += `## ${label} Goals\n\n`;
    for (const g of filtered) {
      const checked = g.status === "COMPLETED" ? "x" : " ";
      const progress = g.progress ?? 0;
      md += `- [${checked}] **${g.title}** (${g.priority}) ${progress}%\n`;
    }
    md += "\n";
  }

  return md;
}
