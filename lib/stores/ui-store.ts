import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  toggleSidebar: () => void;
  selectGoal: (id: string | null) => void;
  openGoalModal: (mode: "create" | "edit", horizon?: string) => void;
  closeGoalModal: () => void;
  setGoalEditData: (data: GoalEditData) => void;
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
    }),
    {
      name: "ascend-ui",
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
