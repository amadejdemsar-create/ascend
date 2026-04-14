"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Play, Square, Coffee, Settings2 } from "lucide-react";
import { useFocusStore, type FocusMode } from "@/lib/stores/focus-store";
import { useCreateFocusSession } from "@/lib/hooks/use-focus";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function FocusTimerWidget() {
  const mode = useFocusStore((s) => s.mode);
  const todoId = useFocusStore((s) => s.todoId);
  const todoTitle = useFocusStore((s) => s.todoTitle);
  const startedAt = useFocusStore((s) => s.startedAt);
  const durationSeconds = useFocusStore((s) => s.durationSeconds);
  const focusDuration = useFocusStore((s) => s.focusDuration);
  const breakDuration = useFocusStore((s) => s.breakDuration);
  const setFocusDuration = useFocusStore((s) => s.setFocusDuration);
  const setBreakDuration = useFocusStore((s) => s.setBreakDuration);
  const startFocus = useFocusStore((s) => s.startFocus);
  const startBreak = useFocusStore((s) => s.startBreak);
  const stop = useFocusStore((s) => s.stop);

  const createSession = useCreateFocusSession();
  const completionGuardRef = useRef(false);

  // Force re-render every second while running so the displayed
  // countdown updates. We compute remaining time from wall clock on
  // every render, so the timer survives tab backgrounding.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (mode === "idle") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [mode]);

  const remaining = (() => {
    if (!startedAt || mode === "idle") return durationSeconds;
    const elapsed =
      (Date.now() - new Date(startedAt).getTime()) / 1000;
    return Math.max(0, durationSeconds - elapsed);
  })();

  // Completion effect: when remaining hits 0, persist the focus session
  // (if we were focusing) and transition to the next mode.
  useEffect(() => {
    if (mode === "idle" || !startedAt) {
      completionGuardRef.current = false;
      return;
    }
    if (remaining > 0) return;
    if (completionGuardRef.current) return;
    completionGuardRef.current = true;

    const endedAt = new Date();
    const startedAtDate = new Date(startedAt);

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(
          mode === "focus" ? "Focus complete!" : "Break complete!",
          {
            body:
              mode === "focus"
                ? "Time for a break."
                : "Ready to focus again?",
          },
        );
      } catch {
        // ignore
      }
    }

    toast.success(
      mode === "focus" ? "Focus session complete!" : "Break complete!",
    );

    if (mode === "focus") {
      createSession.mutate({
        todoId: todoId ?? undefined,
        durationSeconds,
        mode: "focus",
        startedAt: startedAtDate.toISOString(),
        endedAt: endedAt.toISOString(),
      });
      startBreak();
    } else {
      stop();
    }
  }, [
    remaining,
    mode,
    startedAt,
    durationSeconds,
    todoId,
    createSession,
    startBreak,
    stop,
  ]);

  async function handleStart() {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      try {
        await Notification.requestPermission();
      } catch {
        // ignore
      }
    }
    startFocus(null, null);
  }

  function handleStop() {
    // Partial sessions are discarded for now. Only completed focus
    // windows are persisted (see completion effect above).
    stop();
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5">
            {mode === "idle" ? (
              <>
                <Play className="size-3.5" />
                <span className="font-mono">Focus</span>
              </>
            ) : mode === "focus" ? (
              <span className="font-mono">{formatTime(remaining)}</span>
            ) : (
              <>
                <Coffee className="size-3.5" />
                <span className="font-mono">{formatTime(remaining)}</span>
              </>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-72" align="end">
        <FocusTimerControls
          mode={mode}
          todoTitle={todoTitle}
          remaining={remaining}
          focusDuration={focusDuration}
          breakDuration={breakDuration}
          onStart={handleStart}
          onStop={handleStop}
          onSetFocusDuration={setFocusDuration}
          onSetBreakDuration={setBreakDuration}
          onSkipBreak={() => stop()}
        />
      </PopoverContent>
    </Popover>
  );
}

interface ControlsProps {
  mode: FocusMode;
  todoTitle: string | null;
  remaining: number;
  focusDuration: number;
  breakDuration: number;
  onStart: () => void;
  onStop: () => void;
  onSetFocusDuration: (s: number) => void;
  onSetBreakDuration: (s: number) => void;
  onSkipBreak: () => void;
}

function FocusTimerControls({
  mode,
  todoTitle,
  remaining,
  focusDuration,
  breakDuration,
  onStart,
  onStop,
  onSetFocusDuration,
  onSetBreakDuration,
  onSkipBreak,
}: ControlsProps) {
  const [showSettings, setShowSettings] = useState(false);

  if (mode === "focus") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-xs text-muted-foreground">Focusing</p>
        {todoTitle && (
          <p className="truncate text-sm font-medium">{todoTitle}</p>
        )}
        <p className="font-mono text-4xl font-bold">
          {formatTime(remaining)}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onStop}
          className="w-full gap-1.5"
        >
          <Square className="size-3.5" /> Stop
        </Button>
      </div>
    );
  }

  if (mode === "break") {
    return (
      <div className="space-y-3 text-center">
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Coffee className="size-3.5" /> Break
        </p>
        <p className="font-mono text-4xl font-bold">
          {formatTime(remaining)}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onSkipBreak}
          className="w-full"
        >
          Skip break
        </Button>
      </div>
    );
  }

  const presets = [
    { label: "25 / 5", focus: 25 * 60, break: 5 * 60 },
    { label: "50 / 10", focus: 50 * 60, break: 10 * 60 },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Focus session</p>
      <div className="flex gap-1.5">
        {presets.map((p) => (
          <Button
            key={p.label}
            variant={focusDuration === p.focus ? "default" : "outline"}
            size="sm"
            onClick={() => {
              onSetFocusDuration(p.focus);
              onSetBreakDuration(p.break);
            }}
            className="flex-1"
          >
            {p.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowSettings((s) => !s)}
          title="Custom durations"
          aria-label="Custom durations"
        >
          <Settings2 className="size-3.5" />
        </Button>
      </div>
      {showSettings && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Focus (min)</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={Math.floor(focusDuration / 60)}
              onChange={(e) =>
                onSetFocusDuration(
                  Math.max(1, parseInt(e.target.value) || 25) * 60,
                )
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Break (min)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={Math.floor(breakDuration / 60)}
              onChange={(e) =>
                onSetBreakDuration(
                  Math.max(1, parseInt(e.target.value) || 5) * 60,
                )
              }
            />
          </div>
        </div>
      )}
      <Button onClick={onStart} className="w-full gap-1.5">
        <Play className="size-3.5" /> Start focus (
        {Math.floor(focusDuration / 60)} min)
      </Button>
    </div>
  );
}
