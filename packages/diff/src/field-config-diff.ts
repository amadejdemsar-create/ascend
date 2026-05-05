/**
 * Field config diff — compares DatabaseField schema-level changes.
 *
 * Detects name renames, type changes (e.g. TEXT to SELECT), and config
 * object mutations (e.g. SELECT options added/removed, RELATION target
 * changed, FORMULA expression modified).
 */

import type { FieldConfigDiffResult } from "./types";

type FieldPayload = {
  name?: string;
  type?: string;
  config?: Record<string, unknown>;
};

/**
 * Diff two DatabaseField payloads (name, type, config).
 * Returns a structured result surfacing what schema-level attributes changed.
 */
export function diffFieldConfig(
  before: FieldPayload,
  after: FieldPayload,
): FieldConfigDiffResult {
  const result: FieldConfigDiffResult = {
    kind: "field-config-diff",
    configChanges: [],
  };

  // Name change
  if (
    before.name !== after.name &&
    before.name !== undefined &&
    after.name !== undefined
  ) {
    result.nameChange = { before: before.name, after: after.name };
  }

  // Type change
  if (
    before.type !== after.type &&
    before.type !== undefined &&
    after.type !== undefined
  ) {
    result.typeChange = { before: before.type, after: after.type };
  }

  // Config object diff
  const beforeConfig = before.config ?? {};
  const afterConfig = after.config ?? {};
  const keys = Array.from(
    new Set([...Object.keys(beforeConfig), ...Object.keys(afterConfig)]),
  );

  for (const key of keys) {
    const b = beforeConfig[key];
    const a = afterConfig[key];

    if (b === undefined && a !== undefined) {
      result.configChanges.push({ key, change: "added", after: a });
    } else if (b !== undefined && a === undefined) {
      result.configChanges.push({ key, change: "removed", before: b });
    } else if (JSON.stringify(b) !== JSON.stringify(a)) {
      result.configChanges.push({ key, change: "modified", before: b, after: a });
    }
  }

  return result;
}
