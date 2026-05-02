"use client";

import { useRef, useState } from "react";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig, SelectOption } from "@ascend/core";

// ── Types ──────��──────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface MultiSelectEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "MULTI_SELECT" }> };
  value: string[] | null; // option IDs
  onChange: (next: string[] | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
  onAddOption?: (label: string) => Promise<{ id: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const OPTION_COLORS: Record<string, string> = {
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  pink: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

function optionColorClass(color?: string): string {
  if (!color) return "bg-muted text-foreground";
  return OPTION_COLORS[color] ?? "bg-muted text-foreground";
}

const MAX_VALUES = 50;

// ── Component ─────────────────────────────────────────────────────────────

export function MultiSelectEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
  onAddOption,
}: MultiSelectEditorProps) {
  const [open, setOpen] = useState(autoFocus ?? false);
  const [addingOption, setAddingOption] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const options = field.config.options ?? [];
  const selectedIds = new Set(value ?? []);
  const selectedOptions = options.filter((o) => selectedIds.has(o.id));

  function toggleOption(optionId: string) {
    const current = value ?? [];
    if (selectedIds.has(optionId)) {
      const next = current.filter((id) => id !== optionId);
      onChange(next.length > 0 ? next : null);
    } else {
      if (current.length >= MAX_VALUES) return;
      onChange([...current, optionId]);
    }
  }

  function removeOption(optionId: string) {
    const current = value ?? [];
    const next = current.filter((id) => id !== optionId);
    onChange(next.length > 0 ? next : null);
  }

  async function handleAddOption() {
    const trimmed = newOptionLabel.trim();
    if (!trimmed || !onAddOption) return;
    try {
      const result = await onAddOption(trimmed);
      const current = value ?? [];
      if (current.length < MAX_VALUES) {
        onChange([...current, result.id]);
      }
      setNewOptionLabel("");
      setAddingOption(false);
    } catch {
      // handled by caller
    }
  }

  // ── Chips display ─────────────────────────────────────────────────────

  function renderChips(maxVisible: number, showRemove: boolean) {
    const visible = selectedOptions.slice(0, maxVisible);
    const overflow = selectedOptions.length - maxVisible;

    return (
      <div className="flex flex-wrap items-center gap-1">
        {visible.map((opt) => (
          <span
            key={opt.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              optionColorClass(opt.color),
            )}
          >
            {opt.label}
            {showRemove && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeOption(opt.id);
                }}
                className="rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                aria-label={`Remove ${opt.label}`}
              >
                <XIcon className="size-2.5" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-xs text-muted-foreground">+{overflow} more</span>
        )}
        {selectedOptions.length === 0 && (
          <span className="text-muted-foreground text-sm">&mdash;</span>
        )}
      </div>
    );
  }

  // ── Dropdown content ──────────────────────────────────────────────────

  const dropdownContent = (
    <div className="flex flex-col gap-1 max-h-60 overflow-y-auto p-1">
      {options.length === 0 && !addingOption && (
        <p className="text-xs text-muted-foreground px-2 py-1">No options defined.</p>
      )}
      {options.map((opt) => {
        const isSelected = selectedIds.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggleOption(opt.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left w-full",
              "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            role="option"
            aria-selected={isSelected}
            aria-label={opt.label}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded border transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30",
              )}
            >
              {isSelected && <CheckIcon className="size-3" aria-hidden="true" />}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                optionColorClass(opt.color),
              )}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
      {/* Add option section */}
      {onAddOption && (
        <div className="border-t pt-1 mt-1">
          {addingOption ? (
            <div className="flex items-center gap-1 px-1">
              <Input
                ref={addInputRef}
                value={newOptionLabel}
                onChange={(e) => setNewOptionLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddOption();
                  if (e.key === "Escape") {
                    setAddingOption(false);
                    setNewOptionLabel("");
                  }
                }}
                placeholder="Option name..."
                className="h-7 text-xs flex-1"
                aria-label="New option name"
                autoFocus
              />
              <Button size="sm" onClick={handleAddOption} className="h-7 px-2 text-xs">
                Add
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAddingOption(true);
                setTimeout(() => addInputRef.current?.focus(), 0);
              }}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent w-full transition-colors"
            >
              <PlusIcon className="size-3" aria-hidden="true" />
              Add option
            </button>
          )}
        </div>
      )}
    </div>
  );

  // ── Expanded mode ─────────────────────────────────────────────────────

  if (mode === "expanded") {
    return (
      <div className="space-y-2">
        {renderChips(Infinity, true)}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground",
              "border border-dashed hover:bg-muted transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "pointer-events-none opacity-50",
            )}
            aria-label={`Add ${field.name} options`}
          >
            <PlusIcon className="size-3" aria-hidden="true" />
            Add
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            {dropdownContent}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // ── Cell mode ─────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "w-full text-left rounded px-1.5 py-1 transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-label={`Edit ${field.name}`}
      >
        {renderChips(3, false)}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {dropdownContent}
      </PopoverContent>
    </Popover>
  );
}
