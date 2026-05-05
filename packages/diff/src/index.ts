/**
 * @ascend/diff — Pure TypeScript diff engine for Ascend versioning.
 *
 * Platform-agnostic: no DOM, React, Next.js, or Prisma. Only depends on
 * `fast-diff` (text diffing) and `@ascend/core` (shared NodeType type).
 *
 * ## Architecture
 *
 * The top-level `diffNodeVersions` dispatcher switches on `nodeType` and
 * calls the appropriate strategy:
 *
 * - CONTEXT_ENTRY: block-level diff of the Lexical document body.
 * - GOAL / TODO: field-level diff over a known set of entity fields.
 * - DATABASE_ROW: property-level diff with type-aware value comparison.
 * - DATABASE_FIELD: field-config-diff for schema-level changes.
 *
 * ## Metadata fields (hint for future maintainers)
 *
 * CONTEXT_ENTRY_METADATA_FIELDS = ["title", "type", "categoryId", "isPinned", "tags"]
 *
 * These are the entry-level attributes distinct from the block body. If a
 * caller needs to diff metadata separately from body, call `diffFields`
 * directly with the field list. The top-level dispatcher returns body diff
 * because that is the user's primary signal.
 */

import type { NodeType } from "@ascend/core";
import type { DiffResult, PropertyFieldDef } from "./types";
import { diffBlocks } from "./block-diff";
import { diffFields } from "./field-diff";
import { diffProperties } from "./property-diff";
import { diffFieldConfig } from "./field-config-diff";

// Re-export everything for single-import convenience
export * from "./types";
export { textDiff } from "./text-diff";
export { diffBlocks, extractBlocks } from "./block-diff";
export { diffFields } from "./field-diff";
export { diffProperties } from "./property-diff";
export { diffFieldConfig } from "./field-config-diff";

// ── Per-nodeType field lists (internal; not exported) ──────────────────

const GOAL_FIELDS = [
  "title",
  "description",
  "horizon",
  "status",
  "priority",
  "categoryId",
  "parentId",
  "startDate",
  "endDate",
  "progress",
];

const TODO_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "categoryId",
  "goalId",
  "dueDate",
  "scheduledDate",
];

// ── Top-level dispatcher ───────────────────────────────────────────────

/**
 * Computes a diff between two version payloads, dispatching to the correct
 * strategy based on nodeType.
 *
 * @param args.fromPayload - The "before" version payload (Record)
 * @param args.toPayload - The "after" version payload (Record)
 * @param args.nodeType - Discriminator for which diff strategy to use
 * @param args.propertyFieldDefs - Required for DATABASE_ROW; field definitions
 *   from the parent database schema. If omitted, falls back to inferring fields
 *   from the union of keys present in both payloads (with type "TEXT").
 */
export function diffNodeVersions(args: {
  fromPayload: Record<string, unknown>;
  toPayload: Record<string, unknown>;
  nodeType: NodeType;
  propertyFieldDefs?: PropertyFieldDef[];
}): DiffResult {
  switch (args.nodeType) {
    case "CONTEXT_ENTRY":
      return diffBlocks(args.fromPayload, args.toPayload);

    case "GOAL":
      return diffFields(args.fromPayload, args.toPayload, GOAL_FIELDS);

    case "TODO":
      return diffFields(args.fromPayload, args.toPayload, TODO_FIELDS);

    case "DATABASE_ROW": {
      const beforeProps =
        (args.fromPayload.properties as Record<string, unknown>) ?? {};
      const afterProps =
        (args.toPayload.properties as Record<string, unknown>) ?? {};
      const defs: PropertyFieldDef[] =
        args.propertyFieldDefs ??
        Array.from(
          new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)]),
        ).map((id) => ({ id, name: id, type: "TEXT" }));
      return diffProperties(beforeProps, afterProps, defs);
    }

    case "DATABASE_FIELD":
      return diffFieldConfig(
        {
          name: args.fromPayload.name as string | undefined,
          type: args.fromPayload.type as string | undefined,
          config: args.fromPayload.config as
            | Record<string, unknown>
            | undefined,
        },
        {
          name: args.toPayload.name as string | undefined,
          type: args.toPayload.type as string | undefined,
          config: args.toPayload.config as
            | Record<string, unknown>
            | undefined,
        },
      );
  }
}
