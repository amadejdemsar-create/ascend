"use client";

import { useEffect, useRef, useState } from "react";

export interface UseListNavigationOptions<T> {
  items: T[];
  getId: (item: T) => string;
  onOpen?: (item: T) => void;
  onComplete?: (item: T) => void;
  enabled?: boolean;
  scrollToFocused?: boolean;
}

export interface UseListNavigationResult {
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
}

export function useListNavigation<T>({
  items,
  getId,
  onOpen,
  onComplete,
  enabled = true,
  scrollToFocused = true,
}: UseListNavigationOptions<T>): UseListNavigationResult {
  const [focusedId, setFocusedId] = useState<string | null>(() =>
    items.length > 0 ? getId(items[0]) : null,
  );

  // Refs so the keydown listener always sees current values without re-binding
  const itemsRef = useRef(items);
  const getIdRef = useRef(getId);
  const onOpenRef = useRef(onOpen);
  const onCompleteRef = useRef(onComplete);
  const focusedIdRef = useRef(focusedId);
  itemsRef.current = items;
  getIdRef.current = getId;
  onOpenRef.current = onOpen;
  onCompleteRef.current = onComplete;
  focusedIdRef.current = focusedId;

  // Preserve focus when items change; else fall back to first item
  useEffect(() => {
    if (focusedId === null) {
      if (items.length > 0) setFocusedId(getId(items[0]));
      return;
    }
    const stillExists = items.some((item) => getId(item) === focusedId);
    if (!stillExists) {
      setFocusedId(items.length > 0 ? getId(items[0]) : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Scroll focused into view
  useEffect(() => {
    if (!scrollToFocused || !focusedId) return;
    if (typeof document === "undefined") return;
    const el = document.querySelector(
      `[data-list-item-id="${CSS.escape(focusedId)}"]`,
    );
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [focusedId, scrollToFocused]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Skip when typing in inputs
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

      // Skip when modifier keys (Cmd+K must pass through)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const items = itemsRef.current;
      if (items.length === 0) return;

      const currentId = focusedIdRef.current;
      const currentIndex = currentId
        ? items.findIndex((item) => getIdRef.current(item) === currentId)
        : -1;

      let nextIndex = currentIndex;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, items.length - 1);
          if (nextIndex !== currentIndex) {
            e.preventDefault();
            setFocusedId(getIdRef.current(items[nextIndex]));
          }
          break;

        case "k":
        case "ArrowUp":
          nextIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);
          if (nextIndex !== currentIndex) {
            e.preventDefault();
            setFocusedId(getIdRef.current(items[nextIndex]));
          }
          break;

        case "Enter":
          if (onOpenRef.current && currentIndex >= 0) {
            e.preventDefault();
            onOpenRef.current(items[currentIndex]);
          }
          break;

        case "x":
          if (onCompleteRef.current && currentIndex >= 0) {
            e.preventDefault();
            onCompleteRef.current(items[currentIndex]);
          }
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  return { focusedId, setFocusedId };
}
