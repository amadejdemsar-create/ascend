import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SortingState } from "@tanstack/react-table";
import type { TimelineZoom } from "@/lib/timeline-utils";

export type ViewType = "cards" | "list" | "board" | "tree" | "timeline";

export interface ActiveFilters {
  horizon?: "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY";
  status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  priority?: "LOW" | "MEDIUM" | "HIGH";
  categoryId?: string;
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

export type BoardGroupBy = "status" | "horizon" | "category";

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
  boardGroupBy: BoardGroupBy;
  timelineZoom: TimelineZoom;
  timelineYear: number;
  toggleSidebar: () => void;
  selectGoal: (id: string | null) => void;
  openGoalModal: (mode: "create" | "edit", horizon?: string) => void;
  closeGoalModal: () => void;
  setGoalEditData: (data: GoalEditData) => void;
  setActiveView: (view: ViewType) => void;
  setActiveFilters: (filters: ActiveFilters) => void;
  setActiveSorting: (sorting: SortingState) => void;
  setBoardGroupBy: (groupBy: BoardGroupBy) => void;
  setTimelineZoom: (zoom: TimelineZoom) => void;
  setTimelineYear: (year: number) => void;
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
      activeView: "cards",
      activeFilters: {},
      activeSorting: [],
      boardGroupBy: "status",
      timelineZoom: "quarter",
      timelineYear: new Date().getFullYear(),
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
      setBoardGroupBy: (groupBy) => set({ boardGroupBy: groupBy }),
      setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),
      setTimelineYear: (year) => set({ timelineYear: year }),
      resetFilters: () => set({ activeFilters: {}, activeSorting: [] }),
    }),
    {
      name: "ascend-ui",
      version: 4,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          return {
            ...state,
            activeView: "cards",
            activeFilters: {},
            activeSorting: [],
            boardGroupBy: "status",
          };
        }
        if (version === 1) {
          return {
            ...state,
            boardGroupBy: "status",
            timelineZoom: "quarter",
            timelineYear: new Date().getFullYear(),
          };
        }
        if (version === 2) {
          return {
            ...state,
            timelineZoom: "quarter",
            timelineYear: new Date().getFullYear(),
          };
        }
        if (version === 3) {
          return state;
        }
        return state;
      },
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeView: state.activeView,
        activeFilters: state.activeFilters,
        activeSorting: state.activeSorting,
        boardGroupBy: state.boardGroupBy,
        timelineZoom: state.timelineZoom,
        timelineYear: state.timelineYear,
      }),
    }
  )
);
