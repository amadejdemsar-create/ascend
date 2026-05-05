/**
 * Field diff — compares two plain objects field by field.
 *
 * Used for GOAL and TODO nodeTypes where the payload is a flat key-value
 * record of known fields (title, status, priority, etc.).
 *
 * For string fields longer than TEXT_DIFF_THRESHOLD, a character-level
 * textDiff is also computed and attached to the entry.
 */

import type { FieldDiffResult, FieldDiffEntry } from "./types";
import { textDiff } from "./text-diff";

/** Only compute textDiff on strings longer than this threshold. */
const TEXT_DIFF_THRESHOLD = 20;

/**
 * Diff two flat objects over a given set of field names.
 * If `fieldNames` is omitted, the union of all keys from both objects is used.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fieldNames?: string[],
): FieldDiffResult {
  const fields =
    fieldNames ??
    Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const entries: FieldDiffEntry[] = [];

  for (const field of fields) {
    const b = before[field];
    const a = after[field];

    if (b === undefined && a !== undefined) {
      entries.push({ field, change: "added", after: a });
    } else if (b !== undefined && a === undefined) {
      entries.push({ field, change: "removed", before: b });
    } else if (!isEqual(b, a)) {
      const isLongString =
        typeof b === "string" &&
        typeof a === "string" &&
        (b.length > TEXT_DIFF_THRESHOLD || a.length > TEXT_DIFF_THRESHOLD);
      const td = isLongString
        ? textDiff(b as string, a as string)
        : undefined;
      entries.push({ field, change: "modified", before: b, after: a, textDiff: td });
    }
  }

  return { kind: "field-diff", entries };
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}
