"use client";

import { useCallback, useMemo } from "react";
import {
  PlusIcon,
  XIcon,
  FolderPlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PropertyCell } from "@/components/databases/property-editors";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  DatabaseFieldType,
  FilterOp,
  FilterCombinator,
} from "@ascend/core";
import type { DatabaseFieldResponse } from "@/lib/hooks/use-databases";

// ── Types ─────────────────────────────────────────────────────────────────

interface FilterFieldClause {
  type: "field";
  fieldId: string;
  op: FilterOp;
  value: unknown;
}

interface FilterGroup {
  type: "group";
  combinator: FilterCombinator;
  clauses: FilterClause[];
}

type FilterClause = FilterFieldClause | FilterGroup;

export interface Filter {
  combinator: FilterCombinator;
  clauses: FilterClause[];
}

export interface FilterBuilderProps {
  fields: DatabaseFieldResponse[];
  value: Filter | null;
  onChange: (next: Filter | null) => void;
  maxDepth?: number;
}

// ── Operator availability by field type ──────────────────────────────────

const OPS_BY_TYPE: Record<string, FilterOp[]> = {
  TEXT: ["equals", "contains", "starts_with", "ends_with", "is_empty", "is_not_empty"],
  NUMBER: ["equals", "gt", "lt", "gte", "lte", "between", "is_empty", "is_not_empty"],
  DATE: ["equals", "before", "after", "on_or_before", "on_or_after", "between", "is_empty", "is_not_empty", "today", "this_week", "this_month"],
  SELECT: ["equals", "not_equals", "is_empty", "is_not_empty"],
  MULTI_SELECT: ["contains_any", "contains_all", "is_empty", "is_not_empty"],
  RELATION: ["relation_contains", "relation_not_contains", "is_empty", "is_not_empty"],
  CHECKBOX: ["equals"],
  USER: ["equals", "is_empty", "is_not_empty"],
  RATING: ["equals", "gt", "lt", "is_empty", "is_not_empty"],
  URL: ["equals", "contains", "is_empty", "is_not_empty"],
  EMAIL: ["equals", "contains", "is_empty", "is_not_empty"],
  PHONE: ["equals", "contains", "is_empty", "is_not_empty"],
  FILE: ["is_empty", "is_not_empty"],
  FORMULA: ["equals", "contains", "gt", "lt", "is_empty", "is_not_empty"],
};

/** Operators that require no value input. */
const NO_VALUE_OPS: Set<FilterOp> = new Set([
  "is_empty",
  "is_not_empty",
  "today",
  "this_week",
  "this_month",
]);

/** Operators that require two value inputs (range). */
const BETWEEN_OPS: Set<FilterOp> = new Set(["between"]);

/** Human-readable operator labels. */
const OP_LABELS: Partial<Record<FilterOp, string>> = {
  equals: "equals",
  not_equals: "not equals",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  contains: "contains",
  not_contains: "not contains",
  starts_with: "starts with",
  ends_with: "ends with",
  gt: ">",
  lt: "<",
  gte: ">=",
  lte: "<=",
  between: "between",
  before: "before",
  after: "after",
  on_or_before: "on or before",
  on_or_after: "on or after",
  today: "is today",
  this_week: "is this week",
  this_month: "is this month",
  contains_any: "contains any",
  contains_all: "contains all",
  relation_contains: "contains",
  relation_not_contains: "not contains",
};

// ── Helper: get a valid default operator for a field type ────────────────

function getDefaultOp(fieldType: string): FilterOp {
  const ops = OPS_BY_TYPE[fieldType] ?? OPS_BY_TYPE.TEXT;
  return ops[0] ?? "equals";
}

// ── Recursive filter group component ─────────────────────────────────────

interface FilterGroupEditorProps {
  fields: DatabaseFieldResponse[];
  group: Filter;
  onChange: (next: Filter) => void;
  onDelete?: () => void;
  depth: number;
  maxDepth: number;
}

function FilterGroupEditor({
  fields,
  group,
  onChange,
  onDelete,
  depth,
  maxDepth,
}: FilterGroupEditorProps) {
  const handleCombinatorToggle = useCallback(() => {
    onChange({
      ...group,
      combinator: group.combinator === "AND" ? "OR" : "AND",
    });
  }, [group, onChange]);

  const handleAddClause = useCallback(() => {
    const firstField = fields[0];
    if (!firstField) return;
    const newClause: FilterFieldClause = {
      type: "field",
      fieldId: firstField.id,
      op: getDefaultOp(firstField.type),
      value: "",
    };
    onChange({
      ...group,
      clauses: [...group.clauses, newClause],
    });
  }, [fields, group, onChange]);

  const handleAddGroup = useCallback(() => {
    const newGroup: FilterGroup = {
      type: "group",
      combinator: "AND",
      clauses: [],
    };
    onChange({
      ...group,
      clauses: [...group.clauses, newGroup],
    });
  }, [group, onChange]);

  const handleClauseChange = useCallback(
    (index: number, next: FilterClause) => {
      const newClauses = [...group.clauses];
      newClauses[index] = next;
      onChange({ ...group, clauses: newClauses });
    },
    [group, onChange],
  );

  const handleClauseRemove = useCallback(
    (index: number) => {
      const newClauses = group.clauses.filter((_, i) => i !== index);
      onChange({ ...group, clauses: newClauses });
    },
    [group, onChange],
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md",
        depth > 0 && "border border-border/60 p-2 ml-3 bg-muted/20",
      )}
    >
      {/* Group header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCombinatorToggle}
          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors"
          aria-label={`Switch from ${group.combinator} to ${group.combinator === "AND" ? "OR" : "AND"}`}
        >
          {group.combinator === "AND" ? "All of" : "Any of"}
        </button>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={handleAddClause}
          aria-label="Add filter clause"
        >
          <PlusIcon className="size-3" aria-hidden="true" />
          Filter
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={handleAddGroup}
          disabled={depth >= maxDepth}
          aria-label="Add filter group"
        >
          <FolderPlusIcon className="size-3" aria-hidden="true" />
          Group
        </Button>

        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="size-5 ml-auto"
            onClick={onDelete}
            aria-label="Delete filter group"
          >
            <XIcon className="size-3" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Clauses */}
      {group.clauses.map((clause, i) => {
        if (clause.type === "group") {
          return (
            <FilterGroupEditor
              key={i}
              fields={fields}
              group={clause}
              onChange={(next) => handleClauseChange(i, { ...next, type: "group" })}
              onDelete={() => handleClauseRemove(i)}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          );
        }
        return (
          <FilterClauseRow
            key={i}
            fields={fields}
            clause={clause}
            onChange={(next) => handleClauseChange(i, next)}
            onRemove={() => handleClauseRemove(i)}
          />
        );
      })}

      {group.clauses.length === 0 && (
        <p className="text-xs text-muted-foreground px-1 py-1">
          No conditions. Click &ldquo;+ Filter&rdquo; to add one.
        </p>
      )}
    </div>
  );
}

// ── Single filter clause row ─────────────────────────────────────────────

interface FilterClauseRowProps {
  fields: DatabaseFieldResponse[];
  clause: FilterFieldClause;
  onChange: (next: FilterFieldClause) => void;
  onRemove: () => void;
}

function FilterClauseRow({
  fields,
  clause,
  onChange,
  onRemove,
}: FilterClauseRowProps) {
  const selectedField = useMemo(
    () => fields.find((f) => f.id === clause.fieldId) ?? fields[0],
    [fields, clause.fieldId],
  );

  const availableOps = useMemo(() => {
    if (!selectedField) return OPS_BY_TYPE.TEXT;
    return OPS_BY_TYPE[selectedField.type] ?? OPS_BY_TYPE.TEXT;
  }, [selectedField]);

  const handleFieldChange = useCallback(
    (fieldId: string | null) => {
      if (!fieldId) return;
      const newField = fields.find((f) => f.id === fieldId);
      if (!newField) return;
      const newOp = getDefaultOp(newField.type);
      onChange({
        ...clause,
        fieldId,
        op: newOp,
        value: NO_VALUE_OPS.has(newOp) ? null : "",
      });
    },
    [fields, clause, onChange],
  );

  const handleOpChange = useCallback(
    (op: string | null) => {
      if (!op) return;
      const nextOp = op as FilterOp;
      const nextValue = NO_VALUE_OPS.has(nextOp)
        ? null
        : BETWEEN_OPS.has(nextOp)
          ? { from: "", to: "" }
          : "";
      onChange({ ...clause, op: nextOp, value: nextValue });
    },
    [clause, onChange],
  );

  const handleValueChange = useCallback(
    (next: unknown) => {
      onChange({ ...clause, value: next });
    },
    [clause, onChange],
  );

  const showValueInput = !NO_VALUE_OPS.has(clause.op);
  const isBetween = BETWEEN_OPS.has(clause.op);

  // Build a field descriptor compatible with PropertyCell.
  // PropertyCell expects DatabaseField from @ascend/core, but at runtime
  // the config shape satisfies the type when the field is well-formed.
  const cellField = useMemo(() => {
    if (!selectedField) return null;
    return {
      name: selectedField.name,
      type: selectedField.type as DatabaseFieldType,
      config: (selectedField.config ?? { type: selectedField.type }) as Record<string, unknown>,
      isPrimary: selectedField.isPrimary,
      position: selectedField.position,
    };
  }, [selectedField]);

  return (
    <div className="flex items-center gap-1.5 min-h-[32px]">
      {/* Field picker */}
      <Select value={clause.fieldId} onValueChange={handleFieldChange}>
        <SelectTrigger className="h-7 w-[120px] text-xs" aria-label="Filter field">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator picker */}
      <Select value={clause.op} onValueChange={handleOpChange}>
        <SelectTrigger className="h-7 w-[110px] text-xs" aria-label="Filter operator">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableOps.map((op) => (
            <SelectItem key={op} value={op}>
              {OP_LABELS[op] ?? op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value editor */}
      {showValueInput && (
        <div className="flex-1 min-w-[100px]">
          {isBetween ? (
            <BetweenValueEditor
              field={selectedField}
              value={clause.value as { from?: unknown; to?: unknown } | null}
              onChange={handleValueChange}
            />
          ) : cellField ? (
            <PropertyCell
              field={cellField as Parameters<typeof PropertyCell>[0]["field"]}
              value={clause.value}
              onChange={handleValueChange}
              mode="cell"
            />
          ) : (
            <Input
              value={String(clause.value ?? "")}
              onChange={(e) => handleValueChange(e.target.value)}
              className="h-7 text-xs"
              aria-label="Filter value"
            />
          )}
        </div>
      )}

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        onClick={onRemove}
        aria-label="Remove filter clause"
      >
        <XIcon className="size-3" aria-hidden="true" />
      </Button>
    </div>
  );
}

// ── Between value editor (two inputs for range) ──────────────────────────

interface BetweenValueEditorProps {
  field: DatabaseFieldResponse | undefined;
  value: { from?: unknown; to?: unknown } | null;
  onChange: (next: { from: unknown; to: unknown }) => void;
}

function BetweenValueEditor({ field, value, onChange }: BetweenValueEditorProps) {
  const from = (value as Record<string, unknown> | null)?.from ?? "";
  const to = (value as Record<string, unknown> | null)?.to ?? "";

  const isDate = field?.type === "DATE";
  const inputType = isDate ? "date" : "text";

  return (
    <div className="flex items-center gap-1">
      <Input
        type={inputType}
        value={String(from ?? "")}
        onChange={(e) => onChange({ from: e.target.value, to })}
        className="h-7 text-xs flex-1"
        placeholder="From"
        aria-label="Range start"
      />
      <span className="text-xs text-muted-foreground px-0.5">to</span>
      <Input
        type={inputType}
        value={String(to ?? "")}
        onChange={(e) => onChange({ from, to: e.target.value })}
        className="h-7 text-xs flex-1"
        placeholder="To"
        aria-label="Range end"
      />
    </div>
  );
}

// ── Main FilterBuilder component ─────────────────────────────────────────

/**
 * Recursive AND/OR filter builder.
 *
 * Renders a tree of filter groups and field clauses. Each group can contain
 * nested groups (up to `maxDepth` levels) and field comparison clauses.
 * Uses PropertyCell from Phase 6 for type-correct value editing.
 */
export function FilterBuilder({
  fields,
  value,
  onChange,
  maxDepth = 5,
}: FilterBuilderProps) {
  const isEmpty = !value || value.clauses.length === 0;

  const handleAddFirstFilter = useCallback(() => {
    const firstField = fields[0];
    if (!firstField) return;
    onChange({
      combinator: "AND",
      clauses: [
        {
          type: "field",
          fieldId: firstField.id,
          op: getDefaultOp(firstField.type),
          value: "",
        },
      ],
    });
  }, [fields, onChange]);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-start gap-2 py-2">
        <p className="text-xs text-muted-foreground">No filters applied.</p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleAddFirstFilter}
          disabled={fields.length === 0}
        >
          <PlusIcon className="size-3" aria-hidden="true" />
          Add filter
        </Button>
      </div>
    );
  }

  return (
    <FilterGroupEditor
      fields={fields}
      group={value!}
      onChange={(next) => onChange(next)}
      depth={0}
      maxDepth={maxDepth}
    />
  );
}
