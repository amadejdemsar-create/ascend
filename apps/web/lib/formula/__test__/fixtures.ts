/**
 * Formula engine test fixtures.
 *
 * Each fixture tests a specific capability: parsing, evaluation,
 * dependency extraction, and error handling.
 */

import type { FormulaValue } from "../evaluator";
import type { DatabaseFieldType } from "@ascend/core/schemas";

export interface FormulaFixture {
  name: string;
  source: string;
  /** If set, expect parseFormula to return ok:false with error.message containing this substring */
  expectsParseError?: string;
  /** Evaluation context (properties + fields). If absent and no parse error expected, evaluate with empty context. */
  context?: {
    properties: Record<string, unknown>;
    fields: Array<{ id: string; name: string; type: DatabaseFieldType }>;
  };
  /** Expected evaluation result. Compared by type and value. */
  expects?: FormulaValue;
  /** Expected dependency list (lowercase property names). */
  expectsDeps?: string[];
}

export const fixtures: FormulaFixture[] = [
  // ── Arithmetic precedence ──────────────────────────────────────────
  {
    name: "Arithmetic precedence: 1 + 2 * 3 = 7",
    source: "1 + 2 * 3",
    expects: { type: "number", value: 7 },
  },
  {
    name: "Arithmetic grouping: (1 + 2) * 3 = 9",
    source: "(1 + 2) * 3",
    expects: { type: "number", value: 9 },
  },

  // ── Comparison ─────────────────────────────────────────────────────
  {
    name: "Comparison: 5 > 3 = true",
    source: "5 > 3",
    expects: { type: "boolean", value: true },
  },
  {
    name: "Equality: 5 == 6 = false",
    source: "5 == 6",
    expects: { type: "boolean", value: false },
  },
  {
    name: "String equality: \"a\" == \"a\" = true",
    source: '"a" == "a"',
    expects: { type: "boolean", value: true },
  },

  // ── String concat ──────────────────────────────────────────────────
  {
    name: "concat: concat(\"Hello, \", \"world\", \"!\") = \"Hello, world!\"",
    source: 'concat("Hello, ", "world", "!")',
    expects: { type: "string", value: "Hello, world!" },
  },

  // ── Date math ──────────────────────────────────────────────────────
  {
    name: "dateDiff: 14 days between two dates",
    source: 'dateDiff(prop("End"), prop("Start"), "days")',
    context: {
      properties: {
        field_end: "2026-01-15T00:00:00.000Z",
        field_start: "2026-01-01T00:00:00.000Z",
      },
      fields: [
        { id: "field_end", name: "End", type: "DATE" },
        { id: "field_start", name: "Start", type: "DATE" },
      ],
    },
    expects: { type: "number", value: 14 },
    expectsDeps: ["end", "start"],
  },

  // ── Logical operators ──────────────────────────────────────────────
  {
    name: "Logical: true and false = false",
    source: "true and false",
    expects: { type: "boolean", value: false },
  },
  {
    name: "Logical: not true = false",
    source: "not true",
    expects: { type: "boolean", value: false },
  },
  {
    name: "Logical: true or false = true",
    source: "true or false",
    expects: { type: "boolean", value: true },
  },

  // ── Property lookup ────────────────────────────────────────────────
  {
    name: "Property lookup: prop(\"Title\") = \"Foo\"",
    source: 'prop("Title")',
    context: {
      properties: { field_title: "Foo" },
      fields: [{ id: "field_title", name: "Title", type: "TEXT" }],
    },
    expects: { type: "string", value: "Foo" },
    expectsDeps: ["title"],
  },

  // ── Conditional ────────────────────────────────────────────────────
  {
    name: "Conditional: if(prop(\"Status\") == \"Done\", \"check\", \"\") with Status=Done",
    source: 'if(prop("Status") == "Done", "check", "")',
    context: {
      properties: { field_status: "Done" },
      fields: [{ id: "field_status", name: "Status", type: "SELECT" }],
    },
    expects: { type: "string", value: "check" },
    expectsDeps: ["status"],
  },
  {
    name: "Conditional: if(prop(\"Status\") == \"Done\", \"check\", \"\") with Status=InProgress",
    source: 'if(prop("Status") == "Done", "check", "")',
    context: {
      properties: { field_status: "InProgress" },
      fields: [{ id: "field_status", name: "Status", type: "SELECT" }],
    },
    expects: { type: "string", value: "" },
  },

  // ── Length ─────────────────────────────────────────────────────────
  {
    name: "length: length(\"hello\") = 5",
    source: 'length("hello")',
    expects: { type: "number", value: 5 },
  },
  {
    name: "length: length(prop(\"Tags\")) for MULTI_SELECT array",
    source: 'length(prop("Tags"))',
    context: {
      properties: { field_tags: ["a", "b", "c"] },
      fields: [{ id: "field_tags", name: "Tags", type: "MULTI_SELECT" }],
    },
    expects: { type: "number", value: 3 },
    expectsDeps: ["tags"],
  },

  // ── Upper / lower ─────────────────────────────────────────────────
  {
    name: "upper: upper(\"foo\") = \"FOO\"",
    source: 'upper("foo")',
    expects: { type: "string", value: "FOO" },
  },
  {
    name: "lower: lower(\"BAR\") = \"bar\"",
    source: 'lower("BAR")',
    expects: { type: "string", value: "bar" },
  },

  // ── Unary minus ────────────────────────────────────────────────────
  {
    name: "Unary minus: -5 + 3 = -2",
    source: "-5 + 3",
    expects: { type: "number", value: -2 },
  },

  // ── Error case: unknown function ───────────────────────────────────
  {
    name: "Parse error: unknown function xyz()",
    source: "xyz()",
    expectsParseError: "Unknown function: xyz",
  },

  // ── Error case: unknown property at eval time ──────────────────────
  {
    name: "Eval error: unknown property prop(\"Statys\")",
    source: 'prop("Statys")',
    context: {
      properties: { field_status: "Done" },
      fields: [{ id: "field_status", name: "Status", type: "SELECT" }],
    },
    expects: { type: "error", message: "Unknown property: Statys" },
  },

  // ── Error case: expression too large ───────────────────────────────
  {
    name: "Parse error: expression too large (1001+ nodes)",
    // Build a chain of 1001 additions: 1+1+1+...+1 (1001 ones = 1000 + operators + literals)
    // Each addition creates a Binary node (1) with left and right.
    // 502 ones connected by 501 + operators = 502 NumberLiteral + 501 Binary = 1003 nodes
    source: Array(502).fill("1").join("+"),
    expectsParseError: "too large",
  },

  // ── Error case: op counter exceeded ────────────────────────────────
  // We need a valid AST that evaluates to many ops. A deep chain of additions:
  // even though parsed, evaluating 1+1+1+...+1 (5001 terms) should exhaust the counter.
  // Each Binary eval visits 3 nodes (itself + left + right minimum), so 3334 terms should be enough.
  // Actually: each addition is a Binary node. Evaluating it calls evaluateFormula on left,
  // evaluateFormula on right, then does the op. Each evaluateFormula call increments the counter.
  // For n terms chained: n NumberLiteral evals + (n-1) Binary evals = 2n - 1 ops.
  // Need 2n - 1 > 10000 => n > 5000.5 => 5001 terms.
  {
    name: "Eval error: operation limit exceeded",
    // We cannot create a 5001-term expression because it would exceed the 1000 node parse cap.
    // Instead, we will test this programmatically in the runner script.
    // For the fixture array, we skip this by using a smaller expression that WON'T hit the limit.
    // The actual op-counter test is handled as a special case in the runner.
    source: "1 + 1",
    expects: { type: "number", value: 2 },
  },

  // ── Dependency extraction ──────────────────────────────────────────
  {
    name: "Dependencies: prop(\"A\") + prop(\"B\") * prop(\"C\")",
    source: 'prop("A") + prop("B") * prop("C")',
    context: {
      properties: { fa: 1, fb: 2, fc: 3 },
      fields: [
        { id: "fa", name: "A", type: "NUMBER" },
        { id: "fb", name: "B", type: "NUMBER" },
        { id: "fc", name: "C", type: "NUMBER" },
      ],
    },
    expects: { type: "number", value: 7 },
    expectsDeps: ["a", "b", "c"],
  },

  // ── Modulo operator ────────────────────────────────────────────────
  {
    name: "Modulo: 10 % 3 = 1",
    source: "10 % 3",
    expects: { type: "number", value: 1 },
  },

  // ── Division by zero ───────────────────────────────────────────────
  {
    name: "Division by zero error",
    source: "10 / 0",
    expects: { type: "error", message: "Division by zero" },
  },

  // ── Nested function calls ──────────────────────────────────────────
  {
    name: "Nested: upper(concat(\"hello\", \" \", \"world\"))",
    source: 'upper(concat("hello", " ", "world"))',
    expects: { type: "string", value: "HELLO WORLD" },
  },
];
