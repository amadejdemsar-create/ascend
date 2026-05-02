"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface UrlEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "URL" }> };
  value: string | null;
  onChange: (next: string | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Show hostname + first path segment for readability
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${path}`.slice(0, 40);
  } catch {
    return url.slice(0, 40);
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function UrlEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
}: UrlEditorProps) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [draft, setDraft] = useState(value ?? "");
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft with incoming value when not editing
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
    if (!isValidUrl(trimmed)) {
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
          type="url"
          aria-label={field.name}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          disabled={disabled}
          placeholder="https://..."
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
            onClick={() => window.open(value, "_blank", "noopener")}
            aria-label="Open URL in new tab"
            className="shrink-0"
          >
            <ExternalLinkIcon className="size-4" aria-hidden="true" />
            Open
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
        type="url"
        aria-label={field.name}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        disabled={disabled}
        placeholder="https://..."
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
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-primary hover:underline truncate max-w-[150px]"
          aria-label={`Open ${displayUrl(value)}`}
        >
          {displayUrl(value)}
        </a>
        <ExternalLinkIcon
          className="size-3 text-muted-foreground shrink-0"
          aria-hidden="true"
        />
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
