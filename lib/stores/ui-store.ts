import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SortingState } from "@tanstack/react-table";

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
  toggleSidebar: () => void;
  selectGoal: (id: string | null) => void;
  openGoalModal: (mode: "create" | "edit", horizon?: string) => void;
  closeGoalModal: () => void;
  setGoalEditData: (data: GoalEditData) => void;
  setActiveView: (view: ViewType) => void;
  setActiveFilters: (filters: ActiveFilters) => void;
  setActiveSorting: (sorting: SortingState) => void;
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
      resetFilters: () => set({ activeFilters: {}, activeSorting: [] }),
    }),
    {
      name: "ascend-ui",
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          return {
            ...(persistedState as Record<string, unknown>),
            activeView: "cards",
            activeFilters: {},
            activeSorting: [],
          };
        }
        return persistedState as Record<string, unknown>;
      },
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeView: state.activeView,
        activeFilters: state.activeFilters,
        activeSorting: state.activeSorting,
      }),
    }
  )
);
