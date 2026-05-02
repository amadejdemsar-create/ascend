/**
 * Formula engine fixture test runner.
 *
 * Run via: pnpm --filter @ascend/web exec tsx lib/formula/__test__/round-trip.ts
 *
 * Tests parsing, evaluation, and dependency extraction against a set of
 * fixtures. Prints PASS/FAIL per fixture and exits with code 1 on failure.
 */

import { fixtures } from "./fixtures";
import {
  parseFormula,
  evaluateFormula,
  createEvalContext,
  extractDependencies,
  FormulaError,
} from "../index";
import type { FormulaValue, EvalContext } from "../evaluator";
import type { AstNode } from "../ast";

// ── Comparison helpers ─────────────────────────────────────────────────

function valuesMatch(actual: FormulaValue, expected: FormulaValue): boolean {
  if (actual.type !== expected.type) return false;

  switch (actual.type) {
    case "number":
      return actual.value === (expected as { type: "number"; value: number }).value;
    case "string":
      return actual.value === (expected as { type: "string"; value: string }).value;
    case "boolean":
      return actual.value === (expected as { type: "boolean"; value: boolean }).value;
    case "date":
      return (
        actual.value.getTime() ===
        (expected as { type: "date"; value: Date }).value.getTime()
      );
    case "null":
      return true;
    case "error":
      // For error values, check that the message contains expected substring
      return actual.message.includes(
        (expected as { type: "error"; message: string }).message,
      );
    case "array":
      // For arrays, check length and each element
      const expArr = (expected as { type: "array"; value: FormulaValue[] }).value;
      if (actual.value.length !== expArr.length) return false;
      return actual.value.every((v, i) => valuesMatch(v, expArr[i]));
  }
}

function formatValue(val: FormulaValue): string {
  switch (val.type) {
    case "number":
      return `number(${val.value})`;
    case "string":
      return `string("${val.value}")`;
    case "boolean":
      return `boolean(${val.value})`;
    case "date":
      return `date(${val.value.toISOString()})`;
    case "null":
      return "null";
    case "error":
      return `error("${val.message}")`;
    case "array":
      return `array([${val.value.map(formatValue).join(", ")}])`;
  }
}

// ── Runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

console.log("=== Ascend Formula Engine Tests ===\n");

for (const fixture of fixtures) {
  const { name, source, expectsParseError, context, expects, expectsDeps } = fixture;

  try {
    const result = parseFormula(source);

    // Check parse error expectation
    if (expectsParseError) {
      if (result.ok) {
        console.log(`  FAIL  ${name}`);
        console.log(`    Expected parse error containing "${expectsParseError}" but parsing succeeded`);
        failed++;
      } else if (result.error.message.includes(expectsParseError)) {
        console.log(`  PASS  ${name}`);
        passed++;
      } else {
        console.log(`  FAIL  ${name}`);
        console.log(`    Expected error containing "${expectsParseError}"`);
        console.log(`    Got: "${result.error.message}"`);
        failed++;
      }
      continue;
    }

    // Parsing should have succeeded for non-error fixtures
    if (!result.ok) {
      console.log(`  FAIL  ${name}`);
      console.log(`    Unexpected parse error: ${result.error.message}`);
      failed++;
      continue;
    }

    const ast = result.ast;
    let fixtureOk = true;

    // Check dependency extraction
    if (expectsDeps) {
      const actualDeps = extractDependencies(ast).sort();
      const expectedDeps = [...expectsDeps].sort();
      const depsMatch =
        actualDeps.length === expectedDeps.length &&
        actualDeps.every((d, i) => d === expectedDeps[i]);
      if (!depsMatch) {
        console.log(`  FAIL  ${name}`);
        console.log(`    Dependencies: expected [${expectedDeps.join(", ")}], got [${actualDeps.join(", ")}]`);
        failed++;
        fixtureOk = false;
        continue;
      }
    }

    // Check evaluation
    if (expects) {
      const ctx = context
        ? createEvalContext(context.properties, context.fields)
        : createEvalContext({}, []);

      const actual = evaluateFormula(ast, ctx);

      if (!valuesMatch(actual, expects)) {
        console.log(`  FAIL  ${name}`);
        console.log(`    Expected: ${formatValue(expects)}`);
        console.log(`    Got:      ${formatValue(actual)}`);
        failed++;
        fixtureOk = false;
        continue;
      }
    }

    if (fixtureOk) {
      console.log(`  PASS  ${name}`);
      passed++;
    }
  } catch (err) {
    console.log(`  ERROR ${name}: ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

// ── Special test: op counter exceeded ──────────────────────────────────
// We cannot create an expression large enough to trigger the 10k counter
// via fixtures (parse cap is 1000 nodes). Instead we programmatically build
// an AST that exceeds the counter.

console.log("\n--- Special: Operation limit test ---\n");

try {
  // Build a balanced binary tree of depth 14 (2^14 - 1 = 16383 nodes).
  // This stays within recursion depth 50 but exceeds the 10k op counter.
  function buildBalanced(depth: number): AstNode {
    if (depth === 0) return { type: "NumberLiteral", value: 1 };
    return {
      type: "Binary",
      op: "+",
      left: buildBalanced(depth - 1),
      right: buildBalanced(depth - 1),
    };
  }
  const node = buildBalanced(14);

  const ctx: EvalContext = createEvalContext({}, []);
  const result = evaluateFormula(node, ctx);

  if (result.type === "error" && result.message.includes("Operation limit")) {
    console.log("  PASS  Operation limit exceeded (10k ops)");
    passed++;
  } else {
    console.log("  FAIL  Operation limit exceeded (10k ops)");
    console.log(`    Expected error, got: ${formatValue(result)}`);
    failed++;
  }
} catch (err) {
  console.log(`  ERROR  Operation limit test: ${err instanceof Error ? err.message : String(err)}`);
  failed++;
}

// ── Special test: recursion depth exceeded ─────────────────────────────

try {
  // Build a deeply nested unary chain: not not not ... not true (60 deep)
  let node: AstNode = { type: "BooleanLiteral", value: true };
  for (let i = 0; i < 60; i++) {
    node = { type: "Unary", op: "not", operand: node };
  }

  const ctx: EvalContext = createEvalContext({}, []);
  const result = evaluateFormula(node, ctx);

  if (result.type === "error" && result.message.includes("Recursion depth")) {
    console.log("  PASS  Recursion depth exceeded (50)");
    passed++;
  } else {
    console.log("  FAIL  Recursion depth exceeded (50)");
    console.log(`    Expected error, got: ${formatValue(result)}`);
    failed++;
  }
} catch (err) {
  console.log(`  ERROR  Recursion depth test: ${err instanceof Error ? err.message : String(err)}`);
  failed++;
}

// ── Summary ────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
