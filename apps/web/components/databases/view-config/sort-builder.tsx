"use client";

import { useCallback } from "react";
import {
  PlusIcon,
  XIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortItem } from "@ascend/core";
import type { DatabaseFieldResponse } from "@/lib/hooks/use-databases";

// ── Types ─────────────────────────────────────────────────────────────────

export interface SortBuilderProps {
  fields: DatabaseFieldResponse[];
  value: SortItem[];
  onChange: (next: SortItem[]) => void;
  maxClauses?: number;
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Sort builder: ordered list of sort clauses.
 *
 * Each row has a field picker, direction toggle (asc/desc), reorder
 * buttons, and a remove button. Max 10 clauses by default.
 */
export function SortBuilder({
  fields,
  value,
  onChange,
  maxClauses = 10,
}: SortBuilderProps) {
  const handleAddSort = useCallback(() => {
    // Find a field that is not already in the sort list.
    const usedIds = new Set(value.map((s) => s.fieldId));
    const available = fields.find((f) => !usedIds.has(f.id));
    if (!available) return;
    onChange([...value, { fieldId: available.id, direction: "asc" }]);
  }, [fields, value, onChange]);

  const handleFieldChange = useCallback(
    (index: number, fieldId: string | null) => {
      if (!fieldId) return;
      const next = [...value];
      next[index] = { ...next[index], fieldId };
      onChange(next);
    },
    [value, onChange],
  );

  const handleDirectionToggle = useCallback(
    (index: number) => {
      const next = [...value];
      next[index] = {
        ...next[index],
        direction: next[index].direction === "asc" ? "desc" : "asc",
      };
      onChange(next);
    },
    [value, onChange],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const next = [...value];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      onChange(next);
    },
    [value, onChange],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= value.length - 1) return;
      const next = [...value];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      onChange(next);
    },
    [value, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No sort applied.</p>
      )}

      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 min-h-[32px]">
          {/* Field picker */}
          <Select value={item.fieldId} onValueChange={(v) => handleFieldChange(i, v)}>
            <SelectTrigger className="h-7 w-[140px] text-xs" aria-label={`Sort field ${i + 1}`}>
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

          {/* Direction toggle */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1 w-[72px]"
            onClick={() => handleDirectionToggle(i)}
            aria-label={`Sort direction: ${item.direction === "asc" ? "ascending" : "descending"}`}
          >
            {item.direction === "asc" ? (
              <>
                <ArrowUpIcon className="size-3" aria-hidden="true" />
                Asc
              </>
            ) : (
              <>
                <ArrowDownIcon className="size-3" aria-hidden="true" />
                Desc
              </>
            )}
          </Button>

          {/* Reorder buttons */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              onClick={() => handleMoveUp(i)}
              disabled={i === 0}
              aria-label={`Move sort ${i + 1} up`}
            >
              <ChevronUpIcon className="size-3" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              onClick={() => handleMoveDown(i)}
              disabled={i >= value.length - 1}
              aria-label={`Move sort ${i + 1} down`}
            >
              <ChevronDownIcon className="size-3" aria-hidden="true" />
            </Button>
          </div>

          {/* Remove */}
          <Button
            variant="ghost"
            size="icon"
            className="size-5"
            onClick={() => handleRemove(i)}
            aria-label={`Remove sort ${i + 1}`}
          >
            <XIcon className="size-3" aria-hidden="true" />
          </Button>
        </div>
      ))}

      {/* Add sort button */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1 w-fit mt-1"
        onClick={handleAddSort}
        disabled={value.length >= maxClauses || value.length >= fields.length}
        aria-label="Add sort clause"
      >
        <PlusIcon className="size-3" aria-hidden="true" />
        Add sort
      </Button>
    </div>
  );
}
