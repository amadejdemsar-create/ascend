"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/stores/ui-store";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

export function useKeyboardShortcuts(onToggleShortcutRef: () => void) {
  const { setActiveView, openGoalModal, toggleSidebar } = useUIStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (e.metaKey || e.ctrlKey) {
        return;
      }

      switch (e.key) {
        case "1":
          e.preventDefault();
          setActiveView("list");
          router.push("/goals");
          break;
        case "2":
          e.preventDefault();
          setActiveView("tree");
          router.push("/goals");
          break;
        case "3":
          e.preventDefault();
          setActiveView("timeline");
          router.push("/goals");
          break;
        case "n":
          e.preventDefault();
          openGoalModal("create");
          break;
        case "b":
          e.preventDefault();
          toggleSidebar();
          break;
        case "t":
          e.preventDefault();
          if (theme === "light") {
            setTheme("dark");
          } else if (theme === "dark") {
            setTheme("system");
          } else {
            setTheme("light");
          }
          break;
        case "?":
          e.preventDefault();
          onToggleShortcutRef();
          break;
        case "d":
          e.preventDefault();
          router.push("/dashboard");
          break;
        case "s":
          e.preventDefault();
          router.push("/settings");
          break;
        case "Escape": {
          const state = useUIStore.getState();
          if (state.selectedGoalId) {
            e.preventDefault();
            state.selectGoal(null);
          }
          break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setActiveView, openGoalModal, toggleSidebar, theme, setTheme, router, onToggleShortcutRef]);
}
