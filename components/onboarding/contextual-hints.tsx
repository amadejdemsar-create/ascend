"use client";

import { useState, useEffect } from "react";
import { X, Sidebar, Keyboard, Bot } from "lucide-react";

const HINTS_DISMISSED_KEY = "ascend-hints-dismissed";

const hints = [
  {
    icon: Sidebar,
    text: "Use the sidebar to navigate between views",
  },
  {
    icon: Keyboard,
    text: "Press N to quickly create a new goal",
  },
  {
    icon: Bot,
    text: "Connect your AI assistant via MCP for guided goal setup",
  },
];

export function ContextualHints() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(HINTS_DISMISSED_KEY);
    if (stored !== "true") {
      setDismissed(false);
    }
  }, []);

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(HINTS_DISMISSED_KEY, "true");
  }

  if (dismissed) return null;

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Quick tips to get started
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss hints"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {hints.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground ring-1 ring-foreground/5"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary/70" />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
