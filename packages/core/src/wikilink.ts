/**
 * Wikilink parser for Ascend context entries.
 *
 * Extracts typed wikilinks from markdown content. Pure function, no side
 * effects, platform-agnostic. Shared between web editor (save hook) and
 * native editor (Wave 6).
 *
 * Syntax:
 *   [[Title]]                → relation REFERENCES, title "Title"
 *   [[relation:Title]]       → relation maps to ContextLinkType, title "Title"
 *   [[CONTRADICTS:Title]]    → case-insensitive relation matching
 *   [[unknown:Title]]        → fallback to REFERENCES, title "unknown:Title"
 *   \[\[escaped\]\]          → not parsed (treated as literal text)
 *   `[[inside code]]`        → not parsed (code blocks and inline code skipped)
 *   ```\n[[fenced]]\n```     → not parsed (fenced code blocks skipped)
 *
 * Does not deduplicate. Returns all occurrences with character offsets.
 * The caller (service layer) is responsible for collapsing duplicates
 * during link sync.
 */

import {
  CONTEXT_LINK_TYPE_VALUES,
  type ContextLinkType,
} from "./constants/context-types";

export interface ParsedWikilink {
  /** The resolved relation type. */
  relation: ContextLinkType;
  /** The target entry title (trimmed). */
  title: string;
  /** Raw matched text, e.g. "[[contradicts:Kant]]". */
  raw: string;
  /** Character offset (inclusive) in the source content. */
  start: number;
  /** Character offset (exclusive) in the source content. */
  end: number;
}

/**
 * Lowercase relation token to canonical ContextLinkType.
 * Built once at module load from the enum values.
 */
const RELATION_BY_LOWER = new Map<string, ContextLinkType>(
  CONTEXT_LINK_TYPE_VALUES.map((t) => [t.toLowerCase(), t as ContextLinkType]),
);

/**
 * Matches [[...]] wikilinks. The inner content is captured in group 1.
 * Titles can contain any characters except `]]`, including spaces,
 * colons (for relation prefixes), and unicode.
 */
const WIKILINK_RE = /\[\[([^\]]+?)\]\]/g;

/**
 * Parse content for wikilinks and return typed edges.
 *
 * @param content - Raw markdown content string.
 * @returns Array of parsed wikilinks in order of appearance. Empty array
 *   if content is empty/null or contains no wikilinks.
 */
export function parseWikilinks(content: string): ParsedWikilink[] {
  if (!content) return [];

  // Mask out code blocks (``` ... ``` and inline `code`) by replacing
  // them with spaces of equal length. This preserves character offsets
  // so that start/end values remain accurate against the original content.
  const masked = maskCode(content);

  const results: ParsedWikilink[] = [];
  WIKILINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WIKILINK_RE.exec(masked)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Skip if preceded by `\` (escaped wikilink).
    if (start > 0 && content[start - 1] === "\\") continue;

    const inside = match[1];
    const colonIdx = inside.indexOf(":");

    let relation: ContextLinkType = "REFERENCES";
    let title = inside;

    if (colonIdx !== -1) {
      const relToken = inside.slice(0, colonIdx).trim().toLowerCase();
      const maybe = RELATION_BY_LOWER.get(relToken);
      if (maybe) {
        relation = maybe;
        title = inside.slice(colonIdx + 1).trim();
      }
      // Unknown relation: fall back to REFERENCES, keep full `inside` as
      // the title. This lets users write [[http://example.com]] or similar
      // without breaking, treating the colon as part of the title.
    }

    // Skip entries with empty titles (e.g., [[]] or [[contradicts:]])
    if (!title.trim()) continue;

    results.push({
      relation,
      title: title.trim(),
      raw: match[0],
      start,
      end,
    });
  }

  return results;
}

/**
 * Replace code blocks and inline code with spaces of equal length.
 * This prevents wikilinks inside code from being parsed while
 * preserving character offsets for the remaining content.
 */
function maskCode(content: string): string {
  // Triple backtick code fences (multiline, non-greedy).
  const fence = /```[\s\S]*?```/g;
  // Single backtick inline code (no newlines inside).
  const inline = /`[^`\n]*`/g;

  return content
    .replace(fence, (m) => " ".repeat(m.length))
    .replace(inline, (m) => " ".repeat(m.length));
}
