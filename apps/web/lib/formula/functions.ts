/**
 * Formula engine built-in function registry.
 *
 * Each function entry defines its name, expected arity, whether it uses
 * lazy evaluation (for short-circuit semantics), and its implementation.
 *
 * Implementations receive already-evaluated FormulaValue arguments
 * (except for lazy functions like `if`, which are special-cased in the evaluator).
 */

import { startOfDay, add, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears, differenceInHours, differenceInMinutes } from "date-fns";
import type { FormulaValue } from "./evaluator";

// ── Coercion helpers ───────────────────────────────────────────────────

function coerceToString(val: FormulaValue): string {
  switch (val.type) {
    case "string":
      return val.value;
    case "number":
      return String(val.value);
    case "boolean":
      return val.value ? "true" : "false";
    case "date":
      return val.value.toISOString();
    case "null":
      return "";
    case "array":
      return val.value.map(coerceToString).join(", ");
    case "error":
      return `#ERROR: ${val.message}`;
  }
}

function coerceToNumber(val: FormulaValue): FormulaValue {
  if (val.type === "number") return val;
  if (val.type === "string") {
    const n = parseFloat(val.value);
    if (isNaN(n)) return { type: "error", message: `Cannot convert "${val.value}" to number` };
    return { type: "number", value: n };
  }
  if (val.type === "boolean") return { type: "number", value: val.value ? 1 : 0 };
  if (val.type === "null") return { type: "number", value: 0 };
  return { type: "error", message: `Cannot convert ${val.type} to number` };
}

function coerceToDate(val: FormulaValue): FormulaValue {
  if (val.type === "date") return val;
  if (val.type === "string") {
    const d = new Date(val.value);
    if (isNaN(d.getTime())) return { type: "error", message: `Cannot convert "${val.value}" to date` };
    return { type: "date", value: d };
  }
  if (val.type === "number") {
    // Treat as timestamp
    return { type: "date", value: new Date(val.value) };
  }
  return { type: "error", message: `Cannot convert ${val.type} to date` };
}

// ── Function registry entry ────────────────────────────────────────────

export type FunctionArity = number | { min: number; max: number } | "variadic";

export interface FunctionEntry {
  name: string;
  arity: FunctionArity;
  lazy?: boolean;
  impl: (args: FormulaValue[]) => FormulaValue;
}

function checkArity(entry: FunctionEntry, argCount: number): string | null {
  if (entry.arity === "variadic") return null;
  if (typeof entry.arity === "number") {
    if (argCount !== entry.arity) {
      return `${entry.name}() expects ${entry.arity} argument(s), got ${argCount}`;
    }
    return null;
  }
  if (argCount < entry.arity.min || argCount > entry.arity.max) {
    return `${entry.name}() expects ${entry.arity.min}-${entry.arity.max} argument(s), got ${argCount}`;
  }
  return null;
}

// ── Built-in functions ─────────────────────────────────────────────────

const builtins: FunctionEntry[] = [
  {
    name: "concat",
    arity: "variadic",
    impl: (args) => ({
      type: "string",
      value: args.map(coerceToString).join(""),
    }),
  },
  {
    name: "if",
    arity: 3,
    lazy: true,
    // The actual implementation of `if` is handled in the evaluator
    // because it needs lazy evaluation. This impl is a fallback
    // that should never be called directly.
    impl: (args) => {
      const cond = args[0];
      if (cond.type === "error") return cond;
      const truthy =
        cond.type === "boolean"
          ? cond.value
          : cond.type === "null"
            ? false
            : cond.type === "number"
              ? cond.value !== 0
              : cond.type === "string"
                ? cond.value.length > 0
                : true;
      return truthy ? args[1] : args[2];
    },
  },
  {
    name: "today",
    arity: 0,
    impl: () => ({ type: "date", value: startOfDay(new Date()) }),
  },
  {
    name: "now",
    arity: 0,
    impl: () => ({ type: "date", value: new Date() }),
  },
  {
    name: "dateAdd",
    arity: 3,
    impl: (args) => {
      const dateVal = coerceToDate(args[0]);
      if (dateVal.type === "error") return dateVal;
      if (dateVal.type !== "date") return { type: "error", message: "dateAdd: first argument must be a date" };

      const numVal = coerceToNumber(args[1]);
      if (numVal.type === "error") return numVal;
      if (numVal.type !== "number") return { type: "error", message: "dateAdd: second argument must be a number" };

      if (args[2].type !== "string") {
        return { type: "error", message: "dateAdd: third argument must be a unit string" };
      }
      const unit = args[2].value;
      const n = numVal.value;

      switch (unit) {
        case "days":
          return { type: "date", value: add(dateVal.value, { days: n }) };
        case "weeks":
          return { type: "date", value: add(dateVal.value, { weeks: n }) };
        case "months":
          return { type: "date", value: add(dateVal.value, { months: n }) };
        case "years":
          return { type: "date", value: add(dateVal.value, { years: n }) };
        case "hours":
          return { type: "date", value: add(dateVal.value, { hours: n }) };
        case "minutes":
          return { type: "date", value: add(dateVal.value, { minutes: n }) };
        default:
          return { type: "error", message: `dateAdd: unknown unit "${unit}". Expected days, weeks, months, years, hours, or minutes` };
      }
    },
  },
  {
    name: "dateDiff",
    arity: 3,
    impl: (args) => {
      const aVal = coerceToDate(args[0]);
      if (aVal.type === "error") return aVal;
      if (aVal.type !== "date") return { type: "error", message: "dateDiff: first argument must be a date" };

      const bVal = coerceToDate(args[1]);
      if (bVal.type === "error") return bVal;
      if (bVal.type !== "date") return { type: "error", message: "dateDiff: second argument must be a date" };

      if (args[2].type !== "string") {
        return { type: "error", message: "dateDiff: third argument must be a unit string" };
      }
      const unit = args[2].value;

      switch (unit) {
        case "days":
          return { type: "number", value: differenceInDays(aVal.value, bVal.value) };
        case "weeks":
          return { type: "number", value: differenceInWeeks(aVal.value, bVal.value) };
        case "months":
          return { type: "number", value: differenceInMonths(aVal.value, bVal.value) };
        case "years":
          return { type: "number", value: differenceInYears(aVal.value, bVal.value) };
        case "hours":
          return { type: "number", value: differenceInHours(aVal.value, bVal.value) };
        case "minutes":
          return { type: "number", value: differenceInMinutes(aVal.value, bVal.value) };
        default:
          return { type: "error", message: `dateDiff: unknown unit "${unit}". Expected days, weeks, months, years, hours, or minutes` };
      }
    },
  },
  {
    name: "length",
    arity: 1,
    impl: (args) => {
      const val = args[0];
      if (val.type === "string") return { type: "number", value: val.value.length };
      if (val.type === "array") return { type: "number", value: val.value.length };
      if (val.type === "null") return { type: "number", value: 0 };
      if (val.type === "error") return val;
      return { type: "error", message: `length: expected string or array, got ${val.type}` };
    },
  },
  {
    name: "upper",
    arity: 1,
    impl: (args) => {
      const val = args[0];
      if (val.type === "error") return val;
      const str = coerceToString(val);
      return { type: "string", value: str.toUpperCase() };
    },
  },
  {
    name: "lower",
    arity: 1,
    impl: (args) => {
      const val = args[0];
      if (val.type === "error") return val;
      const str = coerceToString(val);
      return { type: "string", value: str.toLowerCase() };
    },
  },
];

// ── Registry ───────────────────────────────────────────────────────────

const registry = new Map<string, FunctionEntry>();
for (const fn of builtins) {
  registry.set(fn.name, fn);
}

export function getFunction(name: string): FunctionEntry | undefined {
  return registry.get(name);
}

export function hasFunction(name: string): boolean {
  return registry.has(name);
}

export function validateFunctionCall(
  name: string,
  argCount: number,
): string | null {
  const entry = registry.get(name);
  if (!entry) return `Unknown function: ${name}`;
  return checkArity(entry, argCount);
}
