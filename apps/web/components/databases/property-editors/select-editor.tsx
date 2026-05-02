"use client";

import { useRef, useState } from "react";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig, SelectOption } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface SelectEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "SELECT" }> };
  value: string | null; // option ID
  onChange: (next: string | null) => void;
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

function getOptionById(options: SelectOption[], id: string | null): SelectOption | undefined {
  if (!id) return undefined;
  return options.find((o) => o.id === id);
}

// ── Component ─────────────────────────────────────────────────────────────

export function SelectEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
  onAddOption,
}: SelectEditorProps) {
  const [open, setOpen] = useState(autoFocus ?? false);
  const [addingOption, setAddingOption] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const options = field.config.options ?? [];
  const selected = getOptionById(options, value);

  function handleSelect(optionId: string) {
    // Toggle off if already selected
    if (optionId === value) {
      onChange(null);
    } else {
      onChange(optionId);
    }
    if (mode === "cell") {
      setOpen(false);
    }
  }

  async function handleAddOption() {
    const trimmed = newOptionLabel.trim();
    if (!trimmed || !onAddOption) return;
    try {
      const result = await onAddOption(trimmed);
      onChange(result.id);
      setNewOptionLabel("");
      setAddingOption(false);
      if (mode === "cell") {
        setOpen(false);
      }
    } catch {
      // handled by caller
    }
  }

  // ── Dropdown content ──────────────────────────────────────────────────

  const dropdownContent = (
    <div className="flex flex-col gap-1 max-h-60 overflow-y-auto p-1">
      {options.length === 0 && !addingOption && (
        <p className="text-xs text-muted-foreground px-2 py-1">No options defined.</p>
      )}
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => handleSelect(opt.id)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left w-full",
            "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            opt.id === value && "bg-accent",
          )}
          aria-label={opt.label}
          aria-selected={opt.id === value}
          role="option"
        >
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              optionColorClass(opt.color),
            )}
          >
            {opt.label}
          </span>
        </button>
      ))}
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-label={`Select ${field.name}`}
        >
          {selected ? (
            <Badge
              variant="ghost"
              className={cn(
                "text-xs px-2 py-0.5",
                optionColorClass(selected.color),
              )}
            >
              {selected.label}
            </Badge>
          ) : (
            <span className="text-muted-foreground">Select...</span>
          )}
          <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {dropdownContent}
        </PopoverContent>
      </Popover>
    );
  }

  // ── Cell mode ─────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "w-full text-left text-sm truncate rounded px-1.5 py-1 transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-label={`Edit ${field.name}`}
      >
        {selected ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              optionColorClass(selected.color),
            )}
          >
            {selected.label}
          </span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {dropdownContent}
      </PopoverContent>
    </Popover>
  );
}
