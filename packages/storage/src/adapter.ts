/**
 * Platform-agnostic storage adapter interface.
 *
 * All methods are async to support both synchronous backends (localStorage)
 * and async backends (AsyncStorage, IndexedDB, SQLite).
 *
 * Implementations MUST be safe to call during server-side rendering.
 * When running outside a browser (or native) context, methods should
 * silently noop: get returns null, set/remove/clear do nothing.
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}
