"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Target,
  Settings,
  Sun,
  Moon,
  Monitor,
  Plus,
  LayoutGrid,
  List,
  Columns3,
  GitBranch,
  GanttChart,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { useCategories } from "@/lib/hooks/use-categories";

export interface CommandAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  group: string;
}

interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

export function useCommandActions(): CommandAction[] {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { openGoalModal, setActiveView, setActiveFilters } = useUIStore();
  const { data: categories } = useCategories();

  return useMemo(() => {
    const actions: CommandAction[] = [
      // Navigation
      {
        id: "nav-dashboard",
        label: "Go to Dashboard",
        icon: LayoutDashboard,
        onSelect: () => router.push("/"),
        group: "Navigation",
      },
      {
        id: "nav-goals",
        label: "Go to Goals",
        icon: Target,
        onSelect: () => router.push("/goals"),
        group: "Navigation",
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        icon: Settings,
        onSelect: () => router.push("/settings"),
        group: "Navigation",
      },

      // Views
      {
        id: "view-cards",
        label: "Switch to Cards View",
        icon: LayoutGrid,
        onSelect: () => {
          setActiveView("cards");
          router.push("/goals");
        },
        group: "Views",
      },
      {
        id: "view-list",
        label: "Switch to List View",
        icon: List,
        onSelect: () => {
          setActiveView("list");
          router.push("/goals");
        },
        group: "Views",
      },
      {
        id: "view-board",
        label: "Switch to Board View",
        icon: Columns3,
        onSelect: () => {
          setActiveView("board");
          router.push("/goals");
        },
        group: "Views",
      },
      {
        id: "view-tree",
        label: "Switch to Tree View",
        icon: GitBranch,
        onSelect: () => {
          setActiveView("tree");
          router.push("/goals");
        },
        group: "Views",
      },
      {
        id: "view-timeline",
        label: "Switch to Timeline View",
        icon: GanttChart,
        onSelect: () => {
          setActiveView("timeline");
          router.push("/goals");
        },
        group: "Views",
      },

      // Goal actions
      {
        id: "goal-create",
        label: "Create New Goal",
        icon: Plus,
        onSelect: () => openGoalModal("create"),
        group: "Goals",
      },
      {
        id: "goal-create-yearly",
        label: "Create Yearly Goal",
        icon: Plus,
        onSelect: () => openGoalModal("create", "YEARLY"),
        group: "Goals",
      },
      {
        id: "goal-create-weekly",
        label: "Create Weekly Goal",
        icon: Plus,
        onSelect: () => openGoalModal("create", "WEEKLY"),
        group: "Goals",
      },

      // Theme
      {
        id: "theme-light",
        label: "Light Mode",
        icon: Sun,
        onSelect: () => setTheme("light"),
        group: "Theme",
      },
      {
        id: "theme-dark",
        label: "Dark Mode",
        icon: Moon,
        onSelect: () => setTheme("dark"),
        group: "Theme",
      },
      {
        id: "theme-system",
        label: "System Theme",
        icon: Monitor,
        onSelect: () => setTheme("system"),
        group: "Theme",
      },
    ];

    // Dynamic category actions
    if (categories && Array.isArray(categories)) {
      const flattenCategories = (nodes: CategoryNode[]): CategoryNode[] => {
        const result: CategoryNode[] = [];
        for (const node of nodes) {
          result.push(node);
          if (node.children) {
            result.push(...flattenCategories(node.children));
          }
        }
        return result;
      };

      const flat = flattenCategories(categories as CategoryNode[]);
      for (const cat of flat) {
        actions.push({
          id: `category-${cat.id}`,
          label: `Filter: ${cat.name}`,
          icon: Tag,
          onSelect: () => {
            setActiveFilters({ categoryId: cat.id });
            router.push("/goals");
          },
          group: "Categories",
        });
      }
    }

    return actions;
  }, [router, setTheme, openGoalModal, setActiveView, setActiveFilters, categories]);
}
