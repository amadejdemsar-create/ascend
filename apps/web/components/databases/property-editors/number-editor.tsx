"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface NumberEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "NUMBER" }> };
  value: number | null;
  onChange: (next: number | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDisplay(value: number | null, precision?: number): string {
  if (value == null) return "";
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: precision ?? 10,
    minimumFractionDigits: 0,
  });
  return formatter.format(value);
}

function roundToPrecision(num: number, precision?: number): number {
  if (precision == null) return num;
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

// ── Component ─────────────────────────────────────────────────────────────

export function NumberEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
}: NumberEditorProps) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const precision = field.config.precision;

  // Sync draft with incoming value when not editing
  useEffect(() => {
    if (!editing) {
      setDraft(value != null ? String(value) : "");
      setInvalid(false);
    }
  }, [value, editing]);

  // Focus on entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === "") {
      onChange(null);
      setInvalid(false);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      // Invalid input: flash red, revert
      setInvalid(true);
      setTimeout(() => setInvalid(false), 600);
      setDraft(value != null ? String(value) : "");
      return;
    }
    const rounded = roundToPrecision(parsed, precision);
    if (rounded !== value) {
      onChange(rounded);
    }
    setDraft(String(rounded));
  }

  function cancel() {
    setEditing(false);
    setDraft(value != null ? String(value) : "");
    setInvalid(false);
  }

  // ── Expanded mode ─────────────────────────────────────────────────────

  if (mode === "expanded") {
    return (
      <Input
        ref={inputRef}
        type="number"
        aria-label={field.name}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        disabled={disabled}
        placeholder={`Enter ${field.name.toLowerCase()}...`}
        data-invalid={invalid || undefined}
        className={cn(
          "transition-colors",
          invalid && "border-destructive ring-destructive/20 ring-2",
        )}
        step={precision != null ? Math.pow(10, -precision) : undefined}
      />
    );
  }

  // ── Cell mode (editing) ───────────────────────────────────────────────

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        aria-label={field.name}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        disabled={disabled}
        data-invalid={invalid || undefined}
        className={cn(
          "h-7 text-sm transition-colors",
          invalid && "border-destructive ring-destructive/20 ring-2",
        )}
        step={precision != null ? Math.pow(10, -precision) : undefined}
      />
    );
  }

  // ── Cell mode (display) ───────────────────────────────────────────────

  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) setEditing(true);
      }}
      className={cn(
        "w-full text-left text-sm truncate rounded px-1.5 py-1 font-mono transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "pointer-events-none opacity-50",
      )}
      aria-label={`Edit ${field.name}`}
      disabled={disabled}
    >
      {value != null ? (
        <span>{formatDisplay(value, precision)}</span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      )}
    </button>
  );
}
