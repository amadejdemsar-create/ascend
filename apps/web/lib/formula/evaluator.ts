/**
 * Formula engine tree-walking evaluator.
 *
 * Evaluates a parsed AST given a row's property bag and field metadata.
 * Enforces bounded execution via:
 *   - 10,000 operation counter
 *   - 50ms wall-clock timeout
 *   - Recursion depth cap of 50
 *
 * Errors propagate as { type: 'error' } values rather than exceptions.
 */

import type { AstNode } from "./ast";
import type { DatabaseFieldType } from "@ascend/core/schemas";
import { getFunction } from "./functions";
import { FormulaError } from "./errors";

// ── Value types ────────────────────────────────────────────────────────

export type FormulaValue =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "date"; value: Date }
  | { type: "array"; value: FormulaValue[] }
  | { type: "null"; value: null }
  | { type: "error"; message: string };

// ── Evaluation context ─────────────────────────────────────────────────

export type EvalContext = {
  /** Raw row.properties JSONB object keyed by field ID */
  properties: Record<string, unknown>;
  /** Field metadata keyed by field ID */
  fields: Map<string, { name: string; type: DatabaseFieldType }>;
  /** Field metadata keyed by lowercase field name (for PropRef lookup) */
  fieldsByName: Map<string, { id: string; type: DatabaseFieldType }>;
  /** Mutable operation counter; shared across recursive calls */
  opCounter: { count: number };
  /** Timestamp (Date.now()) when evaluation started */
  startedAt: number;
  /** Current recursion depth */
  recursionDepth: number;
};

// ── Limits ─────────────────────────────────────────────────────────────

const MAX_OPS = 10_000;
const TIMEOUT_MS = 50;
const MAX_DEPTH = 50;

// ── Helpers ────────────────────────────────────────────────────────────

function isTruthy(val: FormulaValue): boolean {
  switch (val.type) {
    case "boolean":
      return val.value;
    case "number":
      return val.value !== 0;
    case "string":
      return val.value.length > 0;
    case "null":
      return false;
    case "date":
      return true;
    case "array":
      return val.value.length > 0;
    case "error":
      return false;
  }
}

function rawToFormulaValue(
  raw: unknown,
  fieldType: DatabaseFieldType,
): FormulaValue {
  if (raw === null || raw === undefined) {
    return { type: "null", value: null };
  }

  switch (fieldType) {
    case "TEXT":
    case "URL":
    case "EMAIL":
    case "PHONE":
      return { type: "string", value: String(raw) };
    case "NUMBER":
    case "RATING":
      return { type: "number", value: Number(raw) };
    case "CHECKBOX":
      return { type: "boolean", value: Boolean(raw) };
    case "DATE": {
      const d = new Date(raw as string);
      if (isNaN(d.getTime())) return { type: "null", value: null };
      return { type: "date", value: d };
    }
    case "SELECT":
    case "USER":
      return { type: "string", value: String(raw) };
    case "MULTI_SELECT":
    case "RELATION":
    case "FILE":
      if (Array.isArray(raw)) {
        return {
          type: "array",
          value: raw.map((item) => ({ type: "string" as const, value: String(item) })),
        };
      }
      return { type: "null", value: null };
    case "FORMULA":
      // Formula fields referencing other formula fields; this value should
      // already be resolved by the query service. If we get here, return null.
      return { type: "null", value: null };
    default:
      return { type: "null", value: null };
  }
}

function checkLimits(ctx: EvalContext): FormulaValue | null {
  ctx.opCounter.count++;
  if (ctx.opCounter.count > MAX_OPS) {
    return { type: "error", message: "Operation limit exceeded (10000 ops)" };
  }
  if (Date.now() - ctx.startedAt > TIMEOUT_MS) {
    return { type: "error", message: "Evaluation timeout (50ms)" };
  }
  if (ctx.recursionDepth > MAX_DEPTH) {
    return { type: "error", message: "Recursion depth exceeded (50)" };
  }
  return null;
}

// ── Evaluator ──────────────────────────────────────────────────────────

export function evaluateFormula(ast: AstNode, ctx: EvalContext): FormulaValue {
  const limitError = checkLimits(ctx);
  if (limitError) return limitError;

  switch (ast.type) {
    case "NumberLiteral":
      return { type: "number", value: ast.value };

    case "StringLiteral":
      return { type: "string", value: ast.value };

    case "BooleanLiteral":
      return { type: "boolean", value: ast.value };

    case "PropRef":
      return evaluatePropRef(ast.name, ctx);

    case "Unary":
      return evaluateUnary(ast.op, ast.operand, ctx);

    case "Binary":
      return evaluateBinary(ast.op, ast.left, ast.right, ctx);

    case "Call":
      return evaluateCall(ast.name, ast.args, ctx);

    case "Conditional":
      return evaluateConditional(ast.cond, ast.thenBranch, ast.elseBranch, ctx);
  }
}

function evaluatePropRef(name: string, ctx: EvalContext): FormulaValue {
  const field = ctx.fieldsByName.get(name.toLowerCase());
  if (!field) {
    return { type: "error", message: `Unknown property: ${name}` };
  }
  const raw = ctx.properties[field.id];
  return rawToFormulaValue(raw, field.type);
}

function evaluateUnary(
  op: "-" | "not",
  operand: AstNode,
  ctx: EvalContext,
): FormulaValue {
  const val = evaluateFormula(operand, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
  if (val.type === "error") return val;

  if (op === "-") {
    if (val.type === "number") return { type: "number", value: -val.value };
    return { type: "error", message: `Cannot negate ${val.type}` };
  }

  // op === "not"
  return { type: "boolean", value: !isTruthy(val) };
}

function evaluateBinary(
  op: AstNode & { type: "Binary" } extends { op: infer O } ? O : never,
  left: AstNode,
  right: AstNode,
  ctx: EvalContext,
): FormulaValue {
  // Short-circuit for logical operators
  if (op === "and") {
    const lVal = evaluateFormula(left, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
    if (lVal.type === "error") return lVal;
    if (!isTruthy(lVal)) return { type: "boolean", value: false };
    const rVal = evaluateFormula(right, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
    if (rVal.type === "error") return rVal;
    return { type: "boolean", value: isTruthy(rVal) };
  }

  if (op === "or") {
    const lVal = evaluateFormula(left, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
    if (lVal.type === "error") return lVal;
    if (isTruthy(lVal)) return { type: "boolean", value: true };
    const rVal = evaluateFormula(right, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
    if (rVal.type === "error") return rVal;
    return { type: "boolean", value: isTruthy(rVal) };
  }

  const lVal = evaluateFormula(left, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
  if (lVal.type === "error") return lVal;
  const rVal = evaluateFormula(right, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
  if (rVal.type === "error") return rVal;

  // Equality operators work across types
  if (op === "==") return { type: "boolean", value: valuesEqual(lVal, rVal) };
  if (op === "!=") return { type: "boolean", value: !valuesEqual(lVal, rVal) };

  // Comparison operators: numbers and dates
  if (op === "<" || op === "<=" || op === ">" || op === ">=") {
    return compareValues(op, lVal, rVal);
  }

  // Arithmetic operators
  if (op === "+" || op === "-" || op === "*" || op === "/" || op === "%") {
    return arithmetic(op, lVal, rVal);
  }

  return { type: "error", message: `Unknown operator: ${op}` };
}

function evaluateCall(
  name: string,
  args: AstNode[],
  ctx: EvalContext,
): FormulaValue {
  const fn = getFunction(name);
  if (!fn) {
    return { type: "error", message: `Unknown function: ${name}` };
  }

  // Special case: `if` uses lazy evaluation
  if (fn.lazy && name === "if") {
    const condVal = evaluateFormula(args[0], { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
    if (condVal.type === "error") return condVal;
    const branch = isTruthy(condVal) ? args[1] : args[2];
    return evaluateFormula(branch, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
  }

  // Evaluate all arguments eagerly
  const evalArgs: FormulaValue[] = [];
  for (const arg of args) {
    const val = evaluateFormula(arg, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
    if (val.type === "error") return val;
    evalArgs.push(val);
  }

  return fn.impl(evalArgs);
}

function evaluateConditional(
  cond: AstNode,
  thenBranch: AstNode,
  elseBranch: AstNode,
  ctx: EvalContext,
): FormulaValue {
  const condVal = evaluateFormula(cond, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
  if (condVal.type === "error") return condVal;
  const branch = isTruthy(condVal) ? thenBranch : elseBranch;
  return evaluateFormula(branch, { ...ctx, recursionDepth: ctx.recursionDepth + 1 });
}

// ── Value comparison helpers ───────────────────────────────────────────

function valuesEqual(a: FormulaValue, b: FormulaValue): boolean {
  if (a.type === "null" && b.type === "null") return true;
  if (a.type !== b.type) return false;
  if (a.type === "number" && b.type === "number") return a.value === b.value;
  if (a.type === "string" && b.type === "string") return a.value === b.value;
  if (a.type === "boolean" && b.type === "boolean") return a.value === b.value;
  if (a.type === "date" && b.type === "date") return a.value.getTime() === b.value.getTime();
  return false;
}

function compareValues(
  op: "<" | "<=" | ">" | ">=",
  a: FormulaValue,
  b: FormulaValue,
): FormulaValue {
  if (a.type === "number" && b.type === "number") {
    switch (op) {
      case "<": return { type: "boolean", value: a.value < b.value };
      case "<=": return { type: "boolean", value: a.value <= b.value };
      case ">": return { type: "boolean", value: a.value > b.value };
      case ">=": return { type: "boolean", value: a.value >= b.value };
    }
  }
  if (a.type === "date" && b.type === "date") {
    const aTime = a.value.getTime();
    const bTime = b.value.getTime();
    switch (op) {
      case "<": return { type: "boolean", value: aTime < bTime };
      case "<=": return { type: "boolean", value: aTime <= bTime };
      case ">": return { type: "boolean", value: aTime > bTime };
      case ">=": return { type: "boolean", value: aTime >= bTime };
    }
  }
  return {
    type: "error",
    message: `Cannot compare ${a.type} ${op} ${b.type}`,
  };
}

function arithmetic(
  op: "+" | "-" | "*" | "/" | "%",
  a: FormulaValue,
  b: FormulaValue,
): FormulaValue {
  // String concatenation with +
  if (op === "+" && a.type === "string" && b.type === "string") {
    return { type: "string", value: a.value + b.value };
  }

  // Numeric arithmetic
  if (a.type === "number" && b.type === "number") {
    switch (op) {
      case "+": return { type: "number", value: a.value + b.value };
      case "-": return { type: "number", value: a.value - b.value };
      case "*": return { type: "number", value: a.value * b.value };
      case "/":
        if (b.value === 0) return { type: "error", message: "Division by zero" };
        return { type: "number", value: a.value / b.value };
      case "%":
        if (b.value === 0) return { type: "error", message: "Modulo by zero" };
        return { type: "number", value: a.value % b.value };
    }
  }

  return {
    type: "error",
    message: `Cannot apply '${op}' to ${a.type} and ${b.type}`,
  };
}

// ── Factory for creating a fresh EvalContext ───────────────────────────

export function createEvalContext(
  properties: Record<string, unknown>,
  fields: Array<{ id: string; name: string; type: DatabaseFieldType }>,
): EvalContext {
  const fieldsMap = new Map<string, { name: string; type: DatabaseFieldType }>();
  const fieldsByName = new Map<string, { id: string; type: DatabaseFieldType }>();

  for (const f of fields) {
    fieldsMap.set(f.id, { name: f.name, type: f.type });
    fieldsByName.set(f.name.toLowerCase(), { id: f.id, type: f.type });
  }

  return {
    properties,
    fields: fieldsMap,
    fieldsByName,
    opCounter: { count: 0 },
    startedAt: Date.now(),
    recursionDepth: 0,
  };
}
