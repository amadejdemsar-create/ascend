/**
 * Block diff — Lexical-state-aware structural diff.
 *
 * ## Stable block identity
 *
 * Lexical's `__key` is per-editor-session (generated fresh each time the
 * editor mounts). It is NOT stable across loads and cannot be used to match
 * blocks across two serialized snapshots.
 *
 * Instead, we synthesize a stable id of the form:
 *   `${blockType}:${index}:${shortHash(text)}`
 *
 * This id is stable within a single snapshot but NOT directly comparable
 * across two snapshots without an explicit pairing pass. The `pairBlocks`
 * logic matches blocks first by exact text equality (same position, then
 * different position for moves), then by best textDiff similarity below a
 * dissimilarity threshold.
 *
 * ## Snapshot shape
 *
 * The input `payload` is expected to contain a Lexical serialized state
 * either directly (root.children) or nested under `blockDocumentSnapshot`
 * or `snapshot` keys. The tree is walked to extract top-level "blocks"
 * (direct children of root).
 */

import type {
  BlockDiffEntry,
  BlockDiffResult,
  BlockSnapshot,
  TextDiffResult,
} from "./types";
import { textDiff } from "./text-diff";

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Extracts a flat list of block snapshots from a Lexical serialized state.
 * Each block is a top-level child of root, given a synthetic stable id.
 */
export function extractBlocks(
  payload: Record<string, unknown>,
): BlockSnapshot[] {
  const editorState =
    (payload.blockDocumentSnapshot as Record<string, unknown> | undefined) ??
    (payload.snapshot as Record<string, unknown> | undefined) ??
    payload;

  const root = editorState?.root as Record<string, unknown> | undefined;
  const children = (root?.children as unknown[] | undefined) ?? [];

  return children.map((child, index) => {
    const node = child as Record<string, unknown>;
    const blockType = String(node.type ?? "unknown");
    const text = flattenText(node);
    const blockId = `${blockType}:${index}:${shortHash(text)}`;
    return { blockId, blockType, text, raw: node };
  });
}

/**
 * Computes a structural diff between two Lexical document snapshots.
 * Returns entries for added, removed, moved, and modified blocks.
 * Blocks that are identical in both content and position are not surfaced.
 */
export function diffBlocks(
  beforePayload: Record<string, unknown>,
  afterPayload: Record<string, unknown>,
): BlockDiffResult {
  const before = extractBlocks(beforePayload);
  const after = extractBlocks(afterPayload);

  // Track which indices have been paired
  const pairedBefore = new Set<number>();
  const pairedAfter = new Set<number>();
  const pairs: Array<{
    b: number;
    a: number;
    td?: TextDiffResult;
    moved: boolean;
  }> = [];

  // Pass 1: exact text match at same position (unchanged or type-preserved)
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    if (
      before[i].text === after[i].text &&
      before[i].blockType === after[i].blockType
    ) {
      pairedBefore.add(i);
      pairedAfter.add(i);
      pairs.push({ b: i, a: i, moved: false });
    }
  }

  // Pass 2: exact text match at different position (moved blocks)
  for (let i = 0; i < before.length; i++) {
    if (pairedBefore.has(i)) continue;
    for (let j = 0; j < after.length; j++) {
      if (pairedAfter.has(j)) continue;
      if (
        before[i].text === after[j].text &&
        before[i].blockType === after[j].blockType
      ) {
        pairedBefore.add(i);
        pairedAfter.add(j);
        pairs.push({ b: i, a: j, moved: true });
        break;
      }
    }
  }

  // Pass 3: near-text match (modified blocks, potentially moved)
  for (let i = 0; i < before.length; i++) {
    if (pairedBefore.has(i)) continue;
    let bestJ = -1;
    let bestDissimilarity = SIMILARITY_THRESHOLD;
    let bestTd: TextDiffResult | undefined;

    for (let j = 0; j < after.length; j++) {
      if (pairedAfter.has(j)) continue;
      if (before[i].blockType !== after[j].blockType) continue;

      const td = textDiff(before[i].text, after[j].text);
      const distance = td.ops
        .filter((op) => op.op !== "equal")
        .reduce((sum, op) => sum + op.text.length, 0);
      const totalLen = Math.max(before[i].text.length, after[j].text.length, 1);
      const dissimilarity = distance / totalLen;

      if (dissimilarity < bestDissimilarity) {
        bestDissimilarity = dissimilarity;
        bestJ = j;
        bestTd = td;
      }
    }

    if (bestJ >= 0) {
      pairedBefore.add(i);
      pairedAfter.add(bestJ);
      pairs.push({ b: i, a: bestJ, td: bestTd, moved: i !== bestJ });
    }
  }

  // Build diff entries
  const entries: BlockDiffEntry[] = [];

  // Removed blocks (unpaired in before)
  for (let i = 0; i < before.length; i++) {
    if (!pairedBefore.has(i)) {
      entries.push({ change: "removed", block: before[i] });
    }
  }

  // Added blocks (unpaired in after)
  for (let j = 0; j < after.length; j++) {
    if (!pairedAfter.has(j)) {
      entries.push({ change: "added", block: after[j] });
    }
  }

  // Modified and moved blocks (paired with differences)
  for (const pair of pairs) {
    if (pair.td) {
      entries.push({
        change: "modified",
        block: after[pair.a],
        before: before[pair.b],
        textDiff: pair.td,
      });
    } else if (pair.moved) {
      entries.push({
        change: "moved",
        block: after[pair.a],
        fromIndex: pair.b,
        toIndex: pair.a,
      });
    }
    // Exact-match-same-position pairs are "unchanged" and not surfaced
  }

  return { kind: "block-diff", blocks: entries };
}

// ── Internal helpers ───────────────────────────────────────────────────

/** Up to 50% of total length may differ before blocks are considered unrelated */
const SIMILARITY_THRESHOLD = 0.5;

/** Recursively extract text from a Lexical node tree */
function flattenText(node: Record<string, unknown>): string {
  if (typeof node.text === "string") return node.text;
  const children = (node.children as unknown[] | undefined) ?? [];
  return children
    .map((child) => flattenText(child as Record<string, unknown>))
    .join("");
}

/**
 * Tiny non-crypto hash for block id generation. Collisions are acceptable
 * because the id also encodes blockType and index. We only need this to
 * provide a reasonably unique suffix within a single snapshot.
 */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 8);
}
