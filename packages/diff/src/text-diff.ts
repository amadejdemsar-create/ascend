/**
 * Text diff — wraps `fast-diff` into the @ascend/diff TextDiffResult shape.
 *
 * `fast-diff` produces character-level diffs that are efficient and precise.
 * We map its numeric operation codes to our string-based enum.
 */

import diff from "fast-diff";
import type { TextDiffResult, TextDiffOp } from "./types";

const FAST_DIFF_DELETE = -1;
const FAST_DIFF_EQUAL = 0;
const FAST_DIFF_INSERT = 1;

/**
 * Computes a character-level diff between two strings.
 * Returns a TextDiffResult with an array of ops: equal, insert, delete.
 */
export function textDiff(before: string, after: string): TextDiffResult {
  const raw = diff(before, after);
  const ops: TextDiffOp[] = raw.map(([op, text]) => {
    if (op === FAST_DIFF_INSERT) return { op: "insert" as const, text };
    if (op === FAST_DIFF_DELETE) return { op: "delete" as const, text };
    return { op: "equal" as const, text };
  });
  return { ops };
}
