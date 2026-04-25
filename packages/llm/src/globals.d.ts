/**
 * Ambient type declarations for web-standard APIs that exist across
 * all target runtimes (Node 18+, modern browsers, React Native).
 *
 * This file exists because the package uses `lib: ["ES2022"]` without
 * "DOM" to catch browser-only API leaks (document, window, localStorage,
 * etc.). However, fetch, Response, Headers, AbortSignal, and the timer
 * APIs are part of the universal web platform baseline, not DOM-specific.
 *
 * These declarations are intentionally minimal (only the surface area
 * @ascend/llm actually uses) to avoid hiding real DOM dependencies.
 */

// ── Fetch API ────────────────────────────────────────────────────

declare class Headers {
  get(name: string): string | null;
  forEach(
    callbackfn: (value: string, key: string) => void,
  ): void;
}

declare class Response {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

interface RequestInit {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | ArrayBuffer;
  signal?: AbortSignal;
}

type RequestInfo = string;

declare function fetch(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response>;

declare namespace globalThis {
  // eslint-disable-next-line no-var
  var fetch: typeof import("./globals.d.ts").fetch;
}

// ── AbortSignal ──────────────────────────────────────────────────

interface AbortSignalEventListener {
  (): void;
}

declare class AbortSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
  addEventListener(
    type: "abort",
    listener: AbortSignalEventListener,
    options?: { once?: boolean },
  ): void;
  removeEventListener(type: "abort", listener: AbortSignalEventListener): void;
}

// ── Timers ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
declare function setTimeout(handler: Function, timeout?: number): unknown;

declare function clearTimeout(id: unknown): void;
