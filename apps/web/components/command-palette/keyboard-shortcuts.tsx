"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

// Keep this list in sync with `lib/hooks/use-keyboard-shortcuts.ts` and
// `lib/hooks/use-list-navigation.ts`. If you register a new key, mirror it
// here AND in `components/settings/shortcuts-section.tsx`.
const shortcutGroups: ShortcutGroup[] = [
  {
    title: "In-list navigation",
    shortcuts: [
      { keys: ["j"], description: "Move focus down" },
      { keys: ["↓"], description: "Move focus down" },
      { keys: ["k"], description: "Move focus up" },
      { keys: ["↑"], description: "Move focus up" },
      { keys: ["Enter"], description: "Open detail" },
      { keys: ["x"], description: "Toggle complete (todos)" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["d"], description: "Go to Dashboard" },
      { keys: ["s"], description: "Go to Settings" },
      { keys: ["1"], description: "Goals — list view" },
      { keys: ["2"], description: "Goals — tree view" },
      { keys: ["3"], description: "Goals — timeline view" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["n"], description: "New goal" },
      { keys: ["b"], description: "Toggle sidebar" },
      { keys: ["t"], description: "Toggle theme" },
    ],
  },
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Command palette" },
      { keys: ["⌘", "B"], description: "Toggle sidebar" },
      { keys: ["?"], description: "Keyboard shortcuts (this dialog)" },
      { keys: ["Esc"], description: "Close detail or dialog" },
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
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut, i) => (
                  <div
                    key={`${group.title}-${i}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </div>
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
