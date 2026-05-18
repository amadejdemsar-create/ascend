/**
 * `ascend context get <id-or-prefix>` — print one context entry.
 *
 * Resolves the user-supplied id against the entry list, calls
 * GET /api/context/<id>, and renders the entry body.
 *
 * Pretty output: title + type/category/tags meta + extractedText body
 * (falls back to legacy markdown content if extractedText is empty).
 */

import { Command } from "commander";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import {
  relativeDate,
  renderRecord,
  resolveOutputMode,
  truncate,
} from "../../lib/output.js";
import { resolveIdPrefix } from "../../lib/resolve-id.js";

interface ContextListItem {
  id: string;
  title: string;
  type: string;
}

interface ContextEntryDetail {
  id: string;
  title: string;
  content: string | null;
  extractedText: string | null;
  type: string;
  tags: string[];
  isPinned: boolean;
  category: { id: string; name: string; color: string } | null;
  outgoingLinks: Array<{
    id: string;
    type: string;
    toEntry: { id: string; title: string; type: string };
  }>;
  incomingLinks: Array<{
    id: string;
    type: string;
    fromEntry: { id: string; title: string; type: string };
  }>;
  createdAt: string;
  updatedAt: string;
}

interface GetOpts {
  full?: boolean;
  json?: boolean;
  md?: boolean;
}

export function buildContextGetCommand(parent: Command): Command {
  return new Command("get")
    .description("Show one context entry with full body.")
    .argument("<id>", "Entry id or unique leading prefix.")
    .option("--full", "Render the entire body (default truncates at 4000 chars).")
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (idArg: string, opts: GetOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      let entry: ContextEntryDetail;
      const trimmed = idArg.trim();
      if (trimmed.length >= 20) {
        entry = await client.get<ContextEntryDetail>(`/api/context/${trimmed}`);
      } else {
        const list = await client.get<ContextListItem[]>("/api/context");
        const match = resolveIdPrefix({
          query: trimmed,
          candidates: list,
          label: "context",
        });
        entry = await client.get<ContextEntryDetail>(`/api/context/${match.id}`);
      }

      const max = opts.full ? Number.POSITIVE_INFINITY : 4000;

      renderRecord({
        mode: resolveOutputMode(opts),
        row: entry,
        pretty: (e) => prettyEntry(e, max),
        md: (e) => mdEntry(e),
      });
    });
}

function prettyEntry(e: ContextEntryDetail, max: number): string {
  const lines: string[] = [];
  const pin = e.isPinned ? pc.yellow("📌 ") : "";
  lines.push(`${pin}${pc.bold(e.title)}`);
  const meta = [
    pc.dim(e.type.toLowerCase()),
    e.category ? pc.cyan(e.category.name) : null,
    e.tags.length > 0 ? pc.cyan(e.tags.map((t) => `#${t}`).join(" ")) : null,
    pc.dim(`updated ${relativeDate(e.updatedAt)}`),
  ].filter((s): s is string => s !== null);
  lines.push(`  ${meta.join("  ")}`);
  lines.push("");
  const body = (e.extractedText ?? e.content ?? "").trim();
  if (body.length === 0) {
    lines.push(pc.dim("(empty body)"));
  } else if (body.length > max) {
    lines.push(body.slice(0, max));
    lines.push("");
    lines.push(pc.dim(`… ${body.length - max} more chars. Re-run with --full to see all.`));
  } else {
    lines.push(body);
  }
  if (e.outgoingLinks.length > 0 || e.incomingLinks.length > 0) {
    lines.push("");
    lines.push(pc.dim("links"));
    for (const l of e.outgoingLinks.slice(0, 10)) {
      lines.push(`  → ${pc.dim(l.type)} ${truncate(l.toEntry.title, 70)}`);
    }
    for (const l of e.incomingLinks.slice(0, 10)) {
      lines.push(`  ← ${pc.dim(l.type)} ${truncate(l.fromEntry.title, 70)}`);
    }
    const extra =
      Math.max(0, e.outgoingLinks.length - 10) +
      Math.max(0, e.incomingLinks.length - 10);
    if (extra > 0) lines.push(pc.dim(`  … ${extra} more link${extra === 1 ? "" : "s"}`));
  }
  lines.push("");
  lines.push(pc.dim(`id=${e.id}`));
  return lines.join("\n");
}

function mdEntry(e: ContextEntryDetail): string {
  const out: string[] = [];
  out.push(`# ${e.title}`, "");
  const meta = [
    `**type:** ${e.type.toLowerCase()}`,
    e.category ? `**category:** ${e.category.name}` : null,
    e.tags.length > 0 ? `**tags:** ${e.tags.join(", ")}` : null,
  ].filter((s): s is string => s !== null);
  if (meta.length > 0) out.push(meta.join(" · "), "");
  out.push(e.extractedText ?? e.content ?? "_(empty)_");
  out.push("", `_id: ${e.id}_`);
  return out.join("\n");
}
