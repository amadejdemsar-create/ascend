import type { StorageAdapter } from "./adapter.js";

/**
 * Whether we are running in a browser context with localStorage available.
 *
 * Guarded with typeof window check so this module can be safely imported
 * during server-side rendering (Next.js SSR, tests, build steps).
 */
function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage !== undefined;
  } catch {
    // SecurityError in sandboxed iframes or when storage is disabled
    return false;
  }
}

/**
 * Web implementation of StorageAdapter backed by localStorage.
 *
 * JSON-serializes values on write, JSON-parses on read.
 * Silently noops when localStorage is unavailable (SSR, disabled storage).
 */
export const webStorageAdapter: StorageAdapter = {
  async get<T>(key: string): Promise<T | null> {
    if (!hasLocalStorage()) return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    if (!hasLocalStorage()) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // QuotaExceededError or SecurityError; silently ignore
    }
  },

  async remove(key: string): Promise<void> {
    if (!hasLocalStorage()) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // SecurityError; silently ignore
    }
  },

  async clear(): Promise<void> {
    if (!hasLocalStorage()) return;
    try {
      window.localStorage.clear();
    } catch {
      // SecurityError; silently ignore
    }
  },
};
