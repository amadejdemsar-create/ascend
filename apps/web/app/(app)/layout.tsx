"use client";

import { useState, useCallback, ViewTransition } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { KeyboardShortcuts } from "@/components/command-palette/keyboard-shortcuts";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { GoalModal } from "@/components/goals/goal-modal";
import { FocusTimerWidget } from "@/components/focus/focus-timer-widget";
import { SyncIndicator } from "@/components/layout/sync-indicator";
import { SessionExpiredListener } from "@/components/auth/session-expired-listener";

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
      <SessionExpiredListener />
      {/* Skip link for keyboard users: hidden until focused, then jumps past
          the sidebar straight into the main content region. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md focus:outline focus:outline-2 focus:outline-primary"
      >
        Skip to main content
      </a>
      <AppSidebar />
      <SidebarInset>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 md:p-6 pb-20 md:pb-6"
        >
          <ViewTransition>{children}</ViewTransition>
        </main>
        <footer className="sticky bottom-0 z-10 hidden border-t bg-background px-4 py-2 text-xs text-muted-foreground md:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Ascend</span>
            <FocusTimerWidget />
            <SyncIndicator />
          </div>
          <span>
            Press{" "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-xs">
              ?
            </kbd>{" "}
            for shortcuts
          </span>
        </footer>
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
