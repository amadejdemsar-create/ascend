"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/src/style.css";
import { format, parseISO } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface DateEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "DATE" }> };
  value: string | null; // ISO datetime string
  onChange: (next: string | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toDate(iso: string | null): Date | undefined {
  if (!iso) return undefined;
  try {
    return parseISO(iso);
  } catch {
    return undefined;
  }
}

function formatDateDisplay(iso: string | null, includeTime?: boolean): string {
  if (!iso) return "";
  try {
    const d = parseISO(iso);
    const datePart = format(d, "d. M. yyyy");
    if (includeTime) {
      const timePart = format(d, "HH:mm");
      return `${datePart} ${timePart}`;
    }
    return datePart;
  } catch {
    return "";
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function DateEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
}: DateEditorProps) {
  const [open, setOpen] = useState(autoFocus ?? false);
  const [timeDraft, setTimeDraft] = useState(() => {
    if (!value) return "00:00";
    try {
      return format(parseISO(value), "HH:mm");
    } catch {
      return "00:00";
    }
  });
  const timeRef = useRef<HTMLInputElement>(null);

  const includeTime = field.config.includeTime ?? false;
  const selectedDate = toDate(value);

  // Sync time draft when value changes externally
  useEffect(() => {
    if (value) {
      try {
        setTimeDraft(format(parseISO(value), "HH:mm"));
      } catch {
        // keep current
      }
    }
  }, [value]);

  function handleDaySelect(day: Date | undefined) {
    if (!day) {
      onChange(null);
      return;
    }
    if (includeTime) {
      const [hours, minutes] = timeDraft.split(":").map(Number);
      day.setHours(hours || 0, minutes || 0, 0, 0);
    } else {
      // Set to noon to avoid timezone edge issues
      day.setHours(12, 0, 0, 0);
    }
    onChange(day.toISOString());
  }

  function handleTimeChange(timeStr: string) {
    setTimeDraft(timeStr);
    if (!selectedDate) return;
    const [hours, minutes] = timeStr.split(":").map(Number);
    const updated = new Date(selectedDate);
    updated.setHours(hours || 0, minutes || 0, 0, 0);
    onChange(updated.toISOString());
  }

  function handleToday() {
    const now = new Date();
    if (includeTime) {
      onChange(now.toISOString());
      setTimeDraft(format(now, "HH:mm"));
    } else {
      now.setHours(12, 0, 0, 0);
      onChange(now.toISOString());
    }
  }

  function handleClear() {
    onChange(null);
    setTimeDraft("00:00");
  }

  // ── Popover content (shared between both modes) ───────────────────────

  const calendarContent = (
    <div className="flex flex-col gap-2">
      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={handleDaySelect}
        weekStartsOn={1}
        className="p-0"
      />
      {includeTime && (
        <div className="flex items-center gap-2 px-3 pb-1">
          <label htmlFor={`time-${field.name}`} className="text-xs text-muted-foreground">
            Time
          </label>
          <Input
            ref={timeRef}
            id={`time-${field.name}`}
            type="time"
            value={timeDraft}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="h-7 w-28 text-sm"
            aria-label={`Time for ${field.name}`}
          />
        </div>
      )}
      <div className="flex items-center justify-between border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToday}
          className="text-xs"
        >
          Today
        </Button>
        {mode === "expanded" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-muted-foreground"
          >
            <XIcon className="size-3 mr-1" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );

  // ── Expanded mode ─────────────────────────────────────────────────────

  if (mode === "expanded") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-label={`Select date for ${field.name}`}
        >
          <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          {value ? (
            <span>{formatDateDisplay(value, includeTime)}</span>
          ) : (
            <span className="text-muted-foreground">Pick a date...</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          {calendarContent}
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
        {value ? (
          <span>{formatDateDisplay(value, includeTime)}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        {calendarContent}
      </PopoverContent>
    </Popover>
  );
}
