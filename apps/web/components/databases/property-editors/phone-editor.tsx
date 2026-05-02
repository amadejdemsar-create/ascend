"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface PhoneEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "PHONE" }> };
  value: string | null;
  onChange: (next: string | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export function PhoneEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
}: PhoneEditorProps) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value ?? "");
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    // Only validation: max 30 chars per Zod schema
    if (trimmed.length > 30) {
      setDraft(value ?? "");
      return;
    }
    if (trimmed !== value) {
      onChange(trimmed);
    }
  }

  function cancel() {
    setEditing(false);
    setDraft(value ?? "");
  }

  // ── Expanded mode ─────────────────────────────────────────────────────

  if (mode === "expanded") {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="tel"
          aria-label={field.name}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          disabled={disabled}
          placeholder="+1 555 123 4567"
          maxLength={30}
          className="flex-1"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`tel:${value}`, "_self")}
            aria-label="Call phone number"
            className="shrink-0"
          >
            <PhoneIcon className="size-4" aria-hidden="true" />
            Call
          </Button>
        )}
      </div>
    );
  }

  // ── Cell mode (editing) ───────────────────────────────────────────────

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="tel"
        aria-label={field.name}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        disabled={disabled}
        placeholder="+1 555 123 4567"
        maxLength={30}
        className="h-7 text-sm"
      />
    );
  }

  // ── Cell mode (display) ───────────────────────────────────────────────

  if (value) {
    return (
      <div className="flex items-center gap-1 px-1.5 py-1">
        <a
          href={`tel:${value}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-primary hover:underline truncate"
          aria-label={`Call ${value}`}
        >
          {value}
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setEditing(true);
          }}
          className="ml-auto rounded p-0.5 opacity-0 hover:opacity-100 hover:bg-muted transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Edit ${field.name}`}
          disabled={disabled}
        >
          <span className="text-xs text-muted-foreground">Edit</span>
        </button>
      </div>
    );
  }

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
      <span className="text-muted-foreground">&mdash;</span>
    </button>
  );
}
