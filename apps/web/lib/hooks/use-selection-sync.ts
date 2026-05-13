"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/**
 * Two-way sync between a piece of local/Zustand selection state and a URL
 * search param. Reads the param on mount, writes the param on change.
 * Uses `router.replace(?id=...)` to avoid history pollution.
 *
 * paramName defaults to "id". On null selection, the param is removed.
 *
 * This hook lives in apps/web because it depends on next/navigation.
 * It is NOT suitable for shared packages.
 */
export function useSelectionSync({
  selectedId,
  setSelectedId,
  paramName = "id",
}: {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  paramName?: string;
}): void {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Track the last value we applied to the URL so we can distinguish
  // "URL changed because WE changed it" from "URL changed because the
  // user hit back/forward".
  const lastAppliedRef = useRef<string | null>(null);

  // Track whether the initial mount read has happened so we do not
  // re-fire the URL write during the same render cycle.
  const mountedRef = useRef(false);

  // On mount (and when searchParams change, e.g. browser back/forward),
  // read the param and sync into selection state if it differs.
  useEffect(() => {
    const paramValue = searchParams.get(paramName) ?? null;

    // If the param matches what we last wrote, this is our own echo; skip.
    if (paramValue === lastAppliedRef.current) return;

    // Sync the URL value into selection state.
    if (paramValue !== selectedId) {
      setSelectedId(paramValue);
    }

    lastAppliedRef.current = paramValue;
    mountedRef.current = true;
    // We intentionally omit selectedId from deps: this effect reacts to
    // URL changes, not to state changes. The state-to-URL direction is
    // handled by the second effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, paramName, setSelectedId]);

  // Stable callback that writes selectedId into the URL.
  const syncToUrl = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (id) {
        params.set(paramName, id);
      } else {
        params.delete(paramName);
      }

      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;

      lastAppliedRef.current = id;
      router.replace(url, { scroll: false });
    },
    [searchParams, paramName, pathname, router],
  );

  // When selectedId changes (from user interaction), update the URL.
  useEffect(() => {
    // Skip the initial mount: the first effect handles reading the URL.
    if (!mountedRef.current) return;

    // Only write if the value differs from what is currently in the URL.
    const currentParam = searchParams.get(paramName) ?? null;
    if (selectedId === currentParam) return;

    syncToUrl(selectedId);
  }, [selectedId, syncToUrl, searchParams, paramName]);
}
