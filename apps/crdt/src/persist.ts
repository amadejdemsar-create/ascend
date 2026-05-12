/**
 * Persist module for Hocuspocus Database extension.
 *
 * POSTs Yjs binary state to the web app's internal persist endpoint.
 * Uses globalThis.fetch (Node 22 native). Retries on 5xx with
 * exponential backoff. Never blocks the WebSocket connection: all
 * errors are caught, logged, and swallowed.
 */

import type { CrdtContext } from "./auth.js";

const WEB_APP_BASE_URL = process.env.WEB_APP_BASE_URL;
const CRDT_PERSIST_SECRET = process.env.CRDT_PERSIST_SECRET;

if (!WEB_APP_BASE_URL) {
  throw new Error(
    "[crdt] WEB_APP_BASE_URL is not set. Cannot persist document state.",
  );
}
if (!CRDT_PERSIST_SECRET) {
  throw new Error(
    "[crdt] CRDT_PERSIST_SECRET is not set. Cannot authenticate with the web app.",
  );
}

/** Maximum retry attempts on 5xx responses. */
const MAX_RETRIES = 3;

/** Base delay in milliseconds for exponential backoff. */
const BASE_DELAY_MS = 1000;

/**
 * Persist a Yjs document state to the web app.
 *
 * Called by the Hocuspocus Database extension's `store` callback on
 * debounced changes and on client disconnect.
 *
 * The persist endpoint expects:
 *   POST /api/blockdocs/<entryId>/persist
 *   Header: x-crdt-secret: <CRDT_PERSIST_SECRET>
 *   Body: { state: <base64>, snapshot: null, version: -1 }
 *
 * Phase 4 sends snapshot=null because the CRDT server does not have
 * a headless Lexical editor to extract the JSON snapshot from the
 * Yjs doc. Phase 5 will add client-side snapshot submission or
 * server-side extraction.
 *
 * Version is -1 to signal the web app should increment atomically
 * without optimistic concurrency (the CRDT server is the authority
 * on state when it is running).
 *
 * Never throws: all errors are caught, logged, and resolved so
 * Hocuspocus does not fail the connection.
 */
export async function persistDocument(params: {
  documentName: string;
  state: Uint8Array;
  context: CrdtContext;
}): Promise<void> {
  const { documentName, state } = params;
  const startTime = Date.now();

  // Extract entryId from documentName ("blockdoc:<entryId>")
  const entryId = documentName.startsWith("blockdoc:")
    ? documentName.slice("blockdoc:".length)
    : null;

  if (!entryId) {
    console.error(
      `[crdt:persist] Invalid documentName format: "${documentName}". ` +
        'Expected "blockdoc:<entryId>".',
    );
    return;
  }

  const url = `${WEB_APP_BASE_URL}/api/blockdocs/${entryId}/persist`;
  const base64State = Buffer.from(state).toString("base64");
  const body = JSON.stringify({
    state: base64State,
    snapshot: null,
    version: -1,
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await globalThis.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-crdt-secret": CRDT_PERSIST_SECRET!,
        },
        body,
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        console.log(
          `[crdt:persist] ${documentName} persisted in ${duration}ms (status ${response.status})`,
        );
        return;
      }

      // 4xx: terminal error, do not retry (bad request, auth failure, etc.)
      if (response.status >= 400 && response.status < 500) {
        const text = await response.text().catch(() => "");
        console.error(
          `[crdt:persist] ${documentName} failed with ${response.status} in ${duration}ms (terminal, not retrying): ${text}`,
        );
        return;
      }

      // 5xx: transient error, retry with backoff
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[crdt:persist] ${documentName} got ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await sleep(delay);
        continue;
      }

      // Exhausted retries
      const text = await response.text().catch(() => "");
      console.error(
        `[crdt:persist] ${documentName} failed after ${MAX_RETRIES} retries with ${response.status} in ${duration}ms: ${text}`,
      );
    } catch (err) {
      const duration = Date.now() - startTime;

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[crdt:persist] ${documentName} network error, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES}): ${err instanceof Error ? err.message : String(err)}`,
        );
        await sleep(delay);
        continue;
      }

      console.error(
        `[crdt:persist] ${documentName} failed after ${MAX_RETRIES} retries in ${duration}ms: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
