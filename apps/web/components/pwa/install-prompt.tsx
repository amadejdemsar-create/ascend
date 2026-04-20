"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "ascend-install-dismissed";

export function InstallPrompt() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // User previously dismissed the prompt
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    // Only show on tablet and mobile viewports. Chromium fires
    // beforeinstallprompt on desktop too, but installing Ascend as
    // a desktop PWA is low-value (the app is the whole window) and
    // a permanent install nag in the bottom-right of every page on a
    // 1728px screen is obtrusive. Hide on viewports wider than
    // 1024px. (H3 from the 2026-04-11 UX review.)
    const desktop = window.matchMedia("(min-width: 1025px)");
    if (desktop.matches) return;

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setShowBanner(true);
    }

    // If the viewport shrinks below 1024px later (dev tools, rotation),
    // re-attach the listener and show the prompt again.
    function handleViewportChange() {
      if (desktop.matches) {
        setShowBanner(false);
      }
    }
    desktop.addEventListener("change", handleViewportChange);
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      desktop.removeEventListener("change", handleViewportChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === "accepted") {
      setShowBanner(false);
    }
    deferredPrompt.current = null;
  }, []);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, "true");
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-16 left-4 right-4 z-50 md:bottom-4 md:left-auto md:right-4 md:w-80">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
        <Download className="size-5 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Install Ascend</p>
          <p className="text-xs text-muted-foreground">
            Add to your home screen for quick access
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={handleInstall}>
            Install
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
          >
            <X />
          </Button>
        </div>
      </div>
    </div>
  );
}
