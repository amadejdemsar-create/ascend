/**
 * @ascend/diff — Public types
 *
 * Platform-agnostic diff result types consumed by the versioning service,
 * MCP tools, and future mobile/desktop apps. No DOM, React, or Next.js deps.
 */

import type { NodeType } from "@ascend/core";

// ── Text-level diff ────────────────────────────────────────────────────

export type TextDiffOp = { op: "equal" | "insert" | "delete"; text: string };
export type TextDiffResult = { ops: TextDiffOp[] };

// ── Block-level diff (Lexical documents) ───────────────────────────────

export type BlockSnapshot = {
  /** Synthetic stable id: `${blockType}:${index}:${textHash}` */
  blockId: string;
  /** e.g. "paragraph", "heading", "list-item" */
  blockType: string;
  /** Flattened text content of the block */
  text: string;
  /** Original Lexical node JSON */
  raw: Record<string, unknown>;
};

export type BlockDiffEntry =
  | { change: "added"; block: BlockSnapshot }
  | { change: "removed"; block: BlockSnapshot }
  | { change: "moved"; block: BlockSnapshot; fromIndex: number; toIndex: number }
  | {
      change: "modified";
      block: BlockSnapshot;
      before: BlockSnapshot;
      textDiff: TextDiffResult;
    };

export type BlockDiffResult = {
  kind: "block-diff";
  blocks: BlockDiffEntry[];
};

// ── Field-level diff (generic object fields) ───────────────────────────

export type FieldDiffEntry =
  | { field: string; change: "added"; after: unknown }
  | { field: string; change: "removed"; before: unknown }
  | {
      field: string;
      change: "modified";
      before: unknown;
      after: unknown;
      textDiff?: TextDiffResult;
    };

export type FieldDiffResult = {
  kind: "field-diff";
  entries: FieldDiffEntry[];
};

// ── Property-level diff (DatabaseRow JSONB properties) ─────────────────

export type PropertyDiffEntry = {
  fieldId: string;
  fieldName: string;
  /** Matches DatabaseFieldType from @ascend/core */
  fieldType: string;
  change: "added" | "removed" | "modified";
  before?: unknown;
  after?: unknown;
  textDiff?: TextDiffResult;
};

export type PropertyDiffResult = {
  kind: "property-diff";
  entries: PropertyDiffEntry[];
};

// ── Field config diff (DatabaseField config object) ────────────────────

export type FieldConfigDiffResult = {
  kind: "field-config-diff";
  nameChange?: { before: string; after: string };
  typeChange?: { before: string; after: string };
  configChanges: Array<{
    key: string;
    change: "added" | "removed" | "modified";
    before?: unknown;
    after?: unknown;
  }>;
};

// ── Discriminated union of all diff results ────────────────────────────

export type DiffResult =
  | BlockDiffResult
  | FieldDiffResult
  | PropertyDiffResult
  | FieldConfigDiffResult;

// ── Top-level dispatcher args ──────────────────────────────────────────

export type DiffNodeVersionsArgs = {
  fromPayload: Record<string, unknown>;
  toPayload: Record<string, unknown>;
  nodeType: NodeType;
  propertyFieldDefs?: PropertyFieldDef[];
};

export type PropertyFieldDef = {
  id: string;
  name: string;
  type: string;
};
