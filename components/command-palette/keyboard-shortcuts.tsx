"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutItem {
  key: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { key: "1", description: "Cards view" },
      { key: "2", description: "List view" },
      { key: "3", description: "Board view" },
      { key: "4", description: "Tree view" },
      { key: "5", description: "Timeline view" },
      { key: "d", description: "Dashboard" },
      { key: "s", description: "Settings" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { key: "n", description: "New Goal" },
      { key: "b", description: "Toggle Sidebar" },
      { key: "t", description: "Toggle Theme" },
    ],
  },
  {
    title: "Global",
    shortcuts: [
      { key: "Cmd+K", description: "Command Palette" },
      { key: "Esc", description: "Close Dialogs" },
      { key: "?", description: "This Reference" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function KeyboardShortcuts({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                {group.title}
              </h3>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="contents">
                    <div className="flex justify-end">
                      <Kbd>{shortcut.key}</Kbd>
                    </div>
                    <span className="text-sm">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
