"use client";

import { useState, useCallback, ViewTransition } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { KeyboardShortcuts } from "@/components/command-palette/keyboard-shortcuts";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { GoalModal } from "@/components/goals/goal-modal";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [shortcutRefOpen, setShortcutRefOpen] = useState(false);
  const toggleShortcutRef = useCallback(
    () => setShortcutRefOpen((prev) => !prev),
    []
  );

  useKeyboardShortcuts(toggleShortcutRef);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <ViewTransition>{children}</ViewTransition>
        </main>
      </SidebarInset>
      <BottomTabBar />
      <CommandPalette />
      <GoalModal />
      <KeyboardShortcuts
        open={shortcutRefOpen}
        onOpenChange={setShortcutRefOpen}
      />
    </SidebarProvider>
  );
}
