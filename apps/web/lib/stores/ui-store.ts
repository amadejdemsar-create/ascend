import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import type { SortingState } from "@tanstack/react-table";
import type { TimelineZoom } from "@/lib/timeline-utils";
import { webStorageAdapter } from "@ascend/storage/web";

/**
 * Bridge @ascend/storage's StorageAdapter to Zustand's PersistStorage interface.
 *
 * The adapter already handles JSON serialization, so we implement PersistStorage
 * directly instead of going through createJSONStorage (which would double-serialize).
 * StorageValue<S> = { state: S, version?: number } is stored and retrieved as-is
 * through the adapter's JSON serialize/deserialize.
 */
function createAdapterStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name: string): Promise<StorageValue<S> | null> => {
      return webStorageAdapter.get<StorageValue<S>>(name);
    },
    setItem: async (name: string, value: StorageValue<S>): Promise<void> => {
      await webStorageAdapter.set(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
      await webStorageAdapter.remove(name);
    },
  };
}

export type ViewType = "list" | "tree" | "timeline";
export type TodoDateTab = "today" | "week" | "all";

export interface ActiveFilters {
  horizon?: "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY";
  status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  priority?: "LOW" | "MEDIUM" | "HIGH";
  categoryId?: string;
}

export interface ContextFilters {
  tag?: string;
}

interface GoalEditData {
  id: string;
  title?: string;
  description?: string | null;
  horizon?: string;
  priority?: string;
  parentId?: string | null;
  deadline?: string | null;
  specific?: string | null;
  measurable?: string | null;
  attainable?: string | null;
  relevant?: string | null;
  timely?: string | null;
  targetValue?: number | null;
  unit?: string | null;
  notes?: string | null;
}

interface UIStore {
  sidebarCollapsed: boolean;
  selectedGoalId: string | null;
  goalModalOpen: boolean;
  goalModalMode: "create" | "edit";
  goalModalHorizon: "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY" | null;
  goalEditData: GoalEditData | null;
  activeView: ViewType;
  activeFilters: ActiveFilters;
  activeSorting: SortingState;
  timelineZoom: TimelineZoom;
  timelineYear: number;
  timelineMonth: number;
  todoDateTab: TodoDateTab;
  todoHideCompleted: boolean;
  contextFilters: ContextFilters;
  setTodoDateTab: (tab: TodoDateTab) => void;
  setTodoHideCompleted: (hide: boolean) => void;
  setContextTagFilter: (tag: string | null) => void;
  toggleSidebar: () => void;
  selectGoal: (id: string | null) => void;
  openGoalModal: (mode: "create" | "edit", horizon?: string) => void;
  closeGoalModal: () => void;
  setGoalEditData: (data: GoalEditData) => void;
  setActiveView: (view: ViewType) => void;
  setActiveFilters: (filters: ActiveFilters) => void;
  setActiveSorting: (sorting: SortingState) => void;
  setTimelineZoom: (zoom: TimelineZoom) => void;
  setTimelineYear: (year: number) => void;
  setTimelineMonth: (month: number) => void;
  resetFilters: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      selectedGoalId: null,
      goalModalOpen: false,
      goalModalMode: "create",
      goalModalHorizon: null,
      goalEditData: null,
      activeView: "list",
      activeFilters: {},
      activeSorting: [],
      timelineZoom: "quarter",
      timelineYear: new Date().getFullYear(),
      timelineMonth: new Date().getMonth(),
      todoDateTab: "today",
      todoHideCompleted: true,
      contextFilters: {},
      setTodoDateTab: (tab) => set({ todoDateTab: tab }),
      setTodoHideCompleted: (hide) => set({ todoHideCompleted: hide }),
      setContextTagFilter: (tag) =>
        set((s) => ({
          contextFilters: tag
            ? { ...s.contextFilters, tag }
            : { ...s.contextFilters, tag: undefined },
        })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      selectGoal: (id) => set({ selectedGoalId: id }),
      openGoalModal: (mode, horizon) =>
        set({
          goalModalOpen: true,
          goalModalMode: mode,
          goalModalHorizon: (horizon as UIStore["goalModalHorizon"]) ?? null,
          ...(mode === "create" ? { goalEditData: null } : {}),
        }),
      closeGoalModal: () => set({ goalModalOpen: false, goalEditData: null }),
      setGoalEditData: (data) => set({ goalEditData: data }),
      setActiveView: (view) => set({ activeView: view }),
      setActiveFilters: (filters) => set({ activeFilters: filters }),
      setActiveSorting: (sorting) => set({ activeSorting: sorting }),
      setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),
      setTimelineYear: (year) => set({ timelineYear: year }),
      setTimelineMonth: (month) => set({ timelineMonth: month }),
      resetFilters: () => set({ activeFilters: {}, activeSorting: [] }),
    }),
    {
      name: "ascend-ui",
      version: 8,
      storage: createAdapterStorage(),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 4) {
          return {
            ...state,
            activeView: "list",
            activeFilters: state.activeFilters ?? {},
            activeSorting: state.activeSorting ?? [],
            timelineZoom: "quarter",
            timelineYear: new Date().getFullYear(),
            timelineMonth: new Date().getMonth(),
          };
        }
        if (version === 4) {
          const view = state.activeView;
          return {
            ...state,
            activeView: view === "board" || view === "cards" ? "list" : view,
            timelineMonth: new Date().getMonth(),
          };
        }
        if (version === 5) {
          const view = state.activeView;
          return {
            ...state,
            activeView: view === "cards" || view === "board" ? "list" : view,
          };
        }
        if (version === 6) {
          return {
            ...state,
            todoDateTab: "today",
            todoHideCompleted: true,
          };
        }
        if (version === 7) {
          return {
            ...state,
            contextFilters: {},
          };
        }
        return state;
      },
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeView: state.activeView,
        activeFilters: state.activeFilters,
        activeSorting: state.activeSorting,
        timelineZoom: state.timelineZoom,
        timelineYear: state.timelineYear,
        timelineMonth: state.timelineMonth,
        todoDateTab: state.todoDateTab,
        todoHideCompleted: state.todoHideCompleted,
        contextFilters: state.contextFilters,
      }),
    }
  )
);
