"use client";

import { useEffect, useRef, useState } from "react";
import { MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface EmailEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "EMAIL" }> };
  value: string | null;
  onChange: (next: string | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(str: string): boolean {
  return EMAIL_REGEX.test(str) && str.length <= 320;
}

// ── Component ─────────────────────────────────────────────────────────────

export function EmailEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
}: EmailEditorProps) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [draft, setDraft] = useState(value ?? "");
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value ?? "");
      setInvalid(false);
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
      setInvalid(false);
      return;
    }
    if (!isValidEmail(trimmed)) {
      setInvalid(true);
      setTimeout(() => setInvalid(false), 600);
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
    setInvalid(false);
  }

  // ── Expanded mode ─────────────────────────────────────────────────────

  if (mode === "expanded") {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="email"
          aria-label={field.name}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          disabled={disabled}
          placeholder="name@example.com"
          data-invalid={invalid || undefined}
          className={cn(
            "flex-1 transition-colors",
            invalid && "border-destructive ring-destructive/20 ring-2",
          )}
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`mailto:${value}`, "_self")}
            aria-label="Send email"
            className="shrink-0"
          >
            <MailIcon className="size-4" aria-hidden="true" />
            Send
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
        type="email"
        aria-label={field.name}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        disabled={disabled}
        placeholder="name@example.com"
        data-invalid={invalid || undefined}
        className={cn(
          "h-7 text-sm transition-colors",
          invalid && "border-destructive ring-destructive/20 ring-2",
        )}
      />
    );
  }

  // ── Cell mode (display) ───────────────────────────────────────────────

  if (value) {
    return (
      <div className="flex items-center gap-1 px-1.5 py-1">
        <a
          href={`mailto:${value}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-primary hover:underline truncate"
          aria-label={`Email ${value}`}
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
