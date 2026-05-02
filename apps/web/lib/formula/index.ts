/**
 * Ascend Formula Engine
 *
 * Pure TypeScript expression language for FORMULA-typed database fields.
 * No eval(), no Function() constructor, no DOM/Node runtime imports.
 * Safe for adversarial input: bounded parse (1000 AST nodes), bounded
 * evaluation (10k ops, 50ms timeout, recursion depth 50).
 *
 * Architecture decision (Phase 2.9): kept in apps/web/lib/formula/ for v1.
 * Ready to be promoted to packages/formula/ when mobile (Wave 6) needs it.
 * No DOM, no Node, only date-fns as external dependency.
 */

// Re-export public API
export { parseFormula } from "./parser";
export type { ParseResult } from "./parser";

export { evaluateFormula, createEvalContext } from "./evaluator";
export type { FormulaValue, EvalContext } from "./evaluator";

export { extractDependencies } from "./dependencies";

export type { AstNode } from "./ast";
export { countNodes } from "./ast";

export { FormulaError } from "./errors";

// ── Display formatting ─────────────────────────────────────────────────

import type { FormulaValue } from "./evaluator";

/**
 * Formats a FormulaValue for UI display.
 *
 * - Numbers: locale-formatted via Intl.NumberFormat
 * - Dates: ISO short form (YYYY-MM-DD)
 * - Strings: as-is
 * - Booleans: "true" / "false"
 * - Arrays: comma-separated
 * - Null: empty string
 * - Errors: "#ERROR: message"
 */
export function formatFormulaValue(value: FormulaValue): string {
  switch (value.type) {
    case "number": {
      // Use a sensible default format; avoid trailing zeros for integers
      if (Number.isInteger(value.value)) {
        return new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 0,
        }).format(value.value);
      }
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 6,
      }).format(value.value);
    }
    case "string":
      return value.value;
    case "boolean":
      return value.value ? "true" : "false";
    case "date": {
      const d = value.value;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    case "array":
      return value.value
        .map((item) => formatFormulaValue(item))
        .join(", ");
    case "null":
      return "";
    case "error":
      return `#ERROR: ${value.message}`;
  }
}
