"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface TextEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "TEXT" }> };
  value: string | null;
  onChange: (next: string | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export function TextEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
}: TextEditorProps) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft with incoming value when not editing
  useEffect(() => {
    if (!editing) {
      setDraft(value ?? "");
    }
  }, [value, editing]);

  // Focus the input when entering edit mode
  useEffect(() => {
    if (editing && mode === "cell") {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, mode]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    const newValue = trimmed || null;
    if (newValue !== (value ?? null)) {
      onChange(newValue);
    }
  }

  function cancel() {
    setEditing(false);
    setDraft(value ?? "");
  }

  // ── Expanded mode ─────────────────────────────────────────────────────

  if (mode === "expanded") {
    return (
      <Textarea
        ref={textareaRef}
        aria-label={field.name}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
        }}
        rows={5}
        disabled={disabled}
        placeholder={`Enter ${field.name.toLowerCase()}...`}
        className="resize-y min-h-[5lh]"
      />
    );
  }

  // ── Cell mode (editing) ───────────────────────────────────────────────

  if (editing) {
    return (
      <Input
        ref={inputRef}
        aria-label={field.name}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        disabled={disabled}
        className="h-7 text-sm"
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
        "w-full text-left text-sm truncate rounded px-1.5 py-1 transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "pointer-events-none opacity-50",
      )}
      aria-label={`Edit ${field.name}`}
      disabled={disabled}
    >
      {value ? (
        <span className="truncate">{value}</span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      )}
    </button>
  );
}
