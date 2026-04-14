import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FocusMode = "idle" | "focus" | "break";

interface FocusState {
  mode: FocusMode;
  todoId: string | null;
  todoTitle: string | null;
  startedAt: string | null; // ISO timestamp of when the current session started
  durationSeconds: number; // planned duration of the current (in-flight) session
  focusDuration: number; // default focus duration in seconds (e.g. 25 * 60)
  breakDuration: number; // default break duration in seconds (e.g. 5 * 60)
  setFocusDuration: (seconds: number) => void;
  setBreakDuration: (seconds: number) => void;
  startFocus: (todoId: string | null, todoTitle: string | null) => void;
  startBreak: () => void;
  stop: () => void;
  reset: () => void;
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      mode: "idle",
      todoId: null,
      todoTitle: null,
      startedAt: null,
      durationSeconds: 25 * 60,
      focusDuration: 25 * 60,
      breakDuration: 5 * 60,
      setFocusDuration: (s) => set({ focusDuration: s }),
      setBreakDuration: (s) => set({ breakDuration: s }),
      startFocus: (todoId, todoTitle) =>
        set({
          mode: "focus",
          todoId,
          todoTitle,
          startedAt: new Date().toISOString(),
          durationSeconds: get().focusDuration,
        }),
      startBreak: () =>
        set({
          mode: "break",
          todoId: null,
          todoTitle: null,
          startedAt: new Date().toISOString(),
          durationSeconds: get().breakDuration,
        }),
      stop: () =>
        set({
          mode: "idle",
          todoId: null,
          todoTitle: null,
          startedAt: null,
          durationSeconds: 0,
        }),
      reset: () =>
        set({
          mode: "idle",
          todoId: null,
          todoTitle: null,
          startedAt: null,
          durationSeconds: 0,
        }),
    }),
    {
      name: "ascend-focus",
      version: 1,
      partialize: (state) => ({
        mode: state.mode,
        todoId: state.todoId,
        todoTitle: state.todoTitle,
        startedAt: state.startedAt,
        durationSeconds: state.durationSeconds,
        focusDuration: state.focusDuration,
        breakDuration: state.breakDuration,
      }),
    },
  ),
);
