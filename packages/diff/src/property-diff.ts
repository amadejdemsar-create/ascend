/**
 * Property diff — typed property-bag comparison for DatabaseRow JSONB.
 *
 * Field definitions (id, name, type) come from the parent database schema
 * and are passed in as a side input. Type-aware comparison:
 * - TEXT/URL/EMAIL/PHONE: uses textDiff for rich inline display
 * - MULTI_SELECT: order-independent comparison (sorted arrays)
 * - All others: JSON equality
 */

import type { PropertyDiffResult, PropertyDiffEntry, PropertyFieldDef } from "./types";
import { textDiff } from "./text-diff";

const TEXT_LIKE_TYPES = new Set(["TEXT", "URL", "EMAIL", "PHONE"]);

/**
 * Diff two property maps (fieldId to value) given the field definitions.
 * Only fields present in `fieldDefs` are compared (unknown keys are ignored).
 */
export function diffProperties(
  beforeProps: Record<string, unknown>,
  afterProps: Record<string, unknown>,
  fieldDefs: PropertyFieldDef[],
): PropertyDiffResult {
  const entries: PropertyDiffEntry[] = [];

  for (const def of fieldDefs) {
    const b = beforeProps[def.id];
    const a = afterProps[def.id];

    // Both absent: nothing to report
    if (b === undefined && a === undefined) continue;

    if (b === undefined) {
      entries.push({
        fieldId: def.id,
        fieldName: def.name,
        fieldType: def.type,
        change: "added",
        after: a,
      });
      continue;
    }

    if (a === undefined) {
      entries.push({
        fieldId: def.id,
        fieldName: def.name,
        fieldType: def.type,
        change: "removed",
        before: b,
      });
      continue;
    }

    if (valuesEqual(b, a)) continue;

    // Produce textDiff for text-like field types
    const td =
      TEXT_LIKE_TYPES.has(def.type) &&
      typeof b === "string" &&
      typeof a === "string"
        ? textDiff(b, a)
        : undefined;

    entries.push({
      fieldId: def.id,
      fieldName: def.name,
      fieldType: def.type,
      change: "modified",
      before: b,
      after: a,
      textDiff: td,
    });
  }

  return { kind: "property-diff", entries };
}

/**
 * Type-aware equality. Arrays are compared order-independently (for
 * MULTI_SELECT semantics). Scalars and objects use JSON equality.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  }
  return JSON.stringify(a) === JSON.stringify(b);
}
