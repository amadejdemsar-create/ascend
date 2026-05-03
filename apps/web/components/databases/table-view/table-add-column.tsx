"use client";

import { useState, useCallback, useMemo } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DATABASE_FIELD_TYPE_VALUES } from "@ascend/core";
import type { DatabaseFieldType } from "@ascend/core";
import type { DatabaseListItem } from "@/lib/hooks/use-databases";
import { parseFormula } from "@/lib/formula";

// ── Types ─────────────────────────────────────────────────────────────────

interface TableAddColumnProps {
  onAddField: (input: {
    name: string;
    type: DatabaseFieldType;
    config?: Record<string, unknown>;
  }) => void;
  isPending: boolean;
  databases: DatabaseListItem[];
}

// Friendly labels for each field type.
const FIELD_TYPE_LABELS: Record<DatabaseFieldType, { label: string; description: string }> = {
  TEXT: { label: "Text", description: "Plain or rich text" },
  NUMBER: { label: "Number", description: "Numeric values with optional precision" },
  DATE: { label: "Date", description: "Date with optional time" },
  SELECT: { label: "Select", description: "Single choice from options" },
  MULTI_SELECT: { label: "Multi Select", description: "Multiple choices from options" },
  RELATION: { label: "Relation", description: "Link to entries in another database" },
  FORMULA: { label: "Formula", description: "Computed value from other fields" },
  USER: { label: "User", description: "Person reference" },
  CHECKBOX: { label: "Checkbox", description: "True or false" },
  RATING: { label: "Rating", description: "Star rating (1 to max)" },
  URL: { label: "URL", description: "Web address" },
  EMAIL: { label: "Email", description: "Email address" },
  PHONE: { label: "Phone", description: "Phone number" },
  FILE: { label: "File", description: "Attached files" },
};

// ── Component ─────────────────────────────────────────────────────────────

export function TableAddColumn({
  onAddField,
  isPending,
  databases,
}: TableAddColumnProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<DatabaseFieldType>("TEXT");

  // Type-specific config state
  const [selectOptions, setSelectOptions] = useState<Array<{ label: string; color?: string }>>([{ label: "" }]);
  const [targetDatabaseId, setTargetDatabaseId] = useState<string | null>(null);
  const [formulaExpression, setFormulaExpression] = useState("");
  const [ratingMax, setRatingMax] = useState(5);
  const [includeTime, setIncludeTime] = useState(false);
  const [maxFiles, setMaxFiles] = useState(5);
  const [precision, setPrecision] = useState<number | undefined>(undefined);

  // Parse formula in real time for error display.
  const formulaError = useMemo(() => {
    if (type !== "FORMULA" || !formulaExpression.trim()) return null;
    const result = parseFormula(formulaExpression);
    if (!result.ok) return result.error.message;
    return null;
  }, [type, formulaExpression]);

  const resetForm = useCallback(() => {
    setName("");
    setType("TEXT");
    setSelectOptions([{ label: "" }]);
    setTargetDatabaseId(null);
    setFormulaExpression("");
    setRatingMax(5);
    setIncludeTime(false);
    setMaxFiles(5);
    setPrecision(undefined);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Column name is required");
      return;
    }

    // Build config based on type.
    let config: Record<string, unknown> | undefined;

    switch (type) {
      case "SELECT":
      case "MULTI_SELECT": {
        const validOptions = selectOptions
          .filter((o) => o.label.trim())
          .map((o, idx) => ({
            id: crypto.randomUUID(),
            label: o.label.trim(),
            color: o.color,
          }));
        config = { type, options: validOptions };
        break;
      }
      case "RELATION":
        config = { type: "RELATION", targetDatabaseId };
        break;
      case "FORMULA":
        if (!formulaExpression.trim()) {
          toast.error("Formula expression is required");
          return;
        }
        if (formulaError) {
          toast.error("Fix the formula error before adding");
          return;
        }
        config = { type: "FORMULA", expression: formulaExpression.trim() };
        break;
      case "RATING":
        config = { type: "RATING", max: ratingMax };
        break;
      case "DATE":
        config = { type: "DATE", includeTime };
        break;
      case "FILE":
        config = { type: "FILE", maxFiles };
        break;
      case "NUMBER":
        config = precision != null ? { type: "NUMBER", precision } : { type: "NUMBER" };
        break;
      default:
        config = { type };
        break;
    }

    onAddField({ name: trimmed, type, config });
    resetForm();
    setOpen(false);
  }, [
    name,
    type,
    selectOptions,
    targetDatabaseId,
    formulaExpression,
    formulaError,
    ratingMax,
    includeTime,
    maxFiles,
    precision,
    onAddField,
    resetForm,
  ]);

  const addSelectOption = useCallback(() => {
    setSelectOptions((prev) => [...prev, { label: "" }]);
  }, []);

  const updateSelectOption = useCallback((index: number, label: string) => {
    setSelectOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, label } : opt)),
    );
  }, []);

  const removeSelectOption = useCallback((index: number) => {
    setSelectOptions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex items-center justify-center w-9 h-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-l border-border/50"
        aria-label="Add column"
      >
        <PlusIcon className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-h-[70vh] overflow-y-auto"
        aria-label="Add new column"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="col-name">Name</Label>
            <Input
              id="col-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Column name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="col-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DatabaseFieldType)}>
              <SelectTrigger id="col-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATABASE_FIELD_TYPE_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>
                    <div className="flex flex-col">
                      <span>{FIELD_TYPE_LABELS[t].label}</span>
                      <span className="text-xs text-muted-foreground">
                        {FIELD_TYPE_LABELS[t].description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type-specific config forms */}

          {(type === "SELECT" || type === "MULTI_SELECT") && (
            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-1.5">
                {selectOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      value={opt.label}
                      onChange={(e) => updateSelectOption(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className="h-7 text-xs"
                      aria-label={`Option ${idx + 1} label`}
                    />
                    {selectOptions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={() => removeSelectOption(idx)}
                        aria-label={`Remove option ${idx + 1}`}
                      >
                        &times;
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={addSelectOption}
              >
                + Add option
              </Button>
            </div>
          )}

          {type === "RELATION" && (
            <div className="space-y-2">
              <Label htmlFor="col-target-db">Target database</Label>
              <Select
                value={targetDatabaseId ?? "__any__"}
                onValueChange={(v) =>
                  setTargetDatabaseId(v === "__any__" ? null : v)
                }
              >
                <SelectTrigger id="col-target-db">
                  <SelectValue placeholder="Any entry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any entry</SelectItem>
                  {databases.map((db) => (
                    <SelectItem key={db.id} value={db.id}>
                      {db.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "FORMULA" && (
            <div className="space-y-2">
              <Label htmlFor="col-formula">Expression</Label>
              <Textarea
                id="col-formula"
                value={formulaExpression}
                onChange={(e) => setFormulaExpression(e.target.value)}
                placeholder='e.g. prop("Price") * prop("Quantity")'
                className="font-mono text-xs min-h-[60px]"
              />
              {formulaError && (
                <p className="text-xs text-destructive">{formulaError}</p>
              )}
            </div>
          )}

          {type === "RATING" && (
            <div className="space-y-2">
              <Label htmlFor="col-rating-max">Max rating</Label>
              <Input
                id="col-rating-max"
                type="number"
                min={1}
                max={10}
                value={ratingMax}
                onChange={(e) => setRatingMax(Number(e.target.value))}
                className="w-20 h-7 text-xs"
              />
            </div>
          )}

          {type === "DATE" && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="col-include-time"
                checked={includeTime}
                onChange={(e) => setIncludeTime(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="col-include-time" className="text-xs">
                Include time
              </Label>
            </div>
          )}

          {type === "FILE" && (
            <div className="space-y-2">
              <Label htmlFor="col-max-files">Max files</Label>
              <Input
                id="col-max-files"
                type="number"
                min={1}
                max={20}
                value={maxFiles}
                onChange={(e) => setMaxFiles(Number(e.target.value))}
                className="w-20 h-7 text-xs"
              />
            </div>
          )}

          {type === "NUMBER" && (
            <div className="space-y-2">
              <Label htmlFor="col-precision">Decimal places (optional)</Label>
              <Input
                id="col-precision"
                type="number"
                min={0}
                max={10}
                value={precision ?? ""}
                onChange={(e) =>
                  setPrecision(e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="Auto"
                className="w-20 h-7 text-xs"
              />
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
            className="w-full"
            size="sm"
          >
            Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
