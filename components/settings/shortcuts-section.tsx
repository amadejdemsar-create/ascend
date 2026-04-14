"use client";

import { Keyboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SHORTCUT_GROUPS = [
  {
    label: "In-list",
    shortcuts: [
      { keys: ["j"], description: "Move down" },
      { keys: ["k"], description: "Move up" },
      { keys: ["Enter"], description: "Open detail" },
      { keys: ["x"], description: "Toggle complete (todos)" },
    ],
  },
  {
    label: "Navigation",
    shortcuts: [
      { keys: ["1"], description: "Go to Dashboard" },
      { keys: ["2"], description: "Go to Goals" },
      { keys: ["3"], description: "Go to Todos" },
      { keys: ["d"], description: "Go to Dashboard" },
      { keys: ["s"], description: "Go to Settings" },
    ],
  },
  {
    label: "Actions",
    shortcuts: [
      { keys: ["n"], description: "New goal" },
      { keys: ["b"], description: "Set Big 3" },
      { keys: ["t"], description: "New todo" },
    ],
  },
  {
    label: "Global",
    shortcuts: [
      { keys: ["Cmd", "K"], description: "Command palette" },
      { keys: ["?"], description: "Keyboard shortcuts" },
      { keys: ["Esc"], description: "Close panel / dialog" },
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
              {group.shortcuts.map((s) => (
                <div
                  key={s.description}
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
