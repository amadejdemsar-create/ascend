"use client";

import { Keyboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Keep this list in sync with `lib/hooks/use-keyboard-shortcuts.ts` and
// `lib/hooks/use-list-navigation.ts`. If you register a new key, mirror it
// here AND in `components/command-palette/keyboard-shortcuts.tsx`.
const SHORTCUT_GROUPS = [
  {
    label: "In-list navigation",
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
    label: "Navigation",
    shortcuts: [
      { keys: ["d"], description: "Go to Dashboard" },
      { keys: ["s"], description: "Go to Settings" },
      { keys: ["1"], description: "Goals — list view" },
      { keys: ["2"], description: "Goals — tree view" },
      { keys: ["3"], description: "Goals — timeline view" },
    ],
  },
  {
    label: "Actions",
    shortcuts: [
      { keys: ["n"], description: "New goal" },
      { keys: ["b"], description: "Toggle sidebar" },
      { keys: ["t"], description: "Toggle theme" },
    ],
  },
  {
    label: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Command palette" },
      { keys: ["⌘", "B"], description: "Toggle sidebar" },
      { keys: ["?"], description: "Keyboard shortcuts dialog" },
      { keys: ["Esc"], description: "Close detail or dialog" },
    ],
  },
];

export function ShortcutsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Keyboard className="size-4 text-muted-foreground" />
          Keyboard Shortcuts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {group.label}
            </p>
            <div className="space-y-1.5">
              {group.shortcuts.map((s, i) => (
                <div
                  key={`${group.label}-${i}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{s.description}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((key) => (
                      <kbd
                        key={key}
                        className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
