/**
 * Hocuspocus CRDT server bootstrap.
 *
 * Runs as a standalone Node.js process outside the Next.js web app.
 * Authenticates WebSocket connections via short-lived JWTs issued by
 * the web app's POST /api/crdt/token endpoint. Persists Yjs document
 * state back to the web app via POST /api/blockdocs/[entryId]/persist.
 *
 * Does NOT import from apps/web/* (cross-app boundary rule).
 */

import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { Logger } from "@hocuspocus/extension-logger";
import { onAuthenticate, type CrdtContext } from "./auth.js";
import { persistDocument } from "./persist.js";
import { startHealthServer } from "./health.js";

const PORT = parseInt(process.env.PORT || "1234", 10);
const HEALTH_PORT = PORT + 1;

const server = new Server<CrdtContext>({
  port: PORT,
  // Debounce onStoreDocument to avoid hammering the persist endpoint
  // on every single keystroke. 5s debounce, 30s max.
  debounce: 5000,
  maxDebounce: 30000,

  async onAuthenticate(data) {
    return onAuthenticate(data);
  },

  async onListen(data) {
    console.log(`[crdt] listening on :${data.port}`);
  },

  extensions: [
    new Logger(),

    new Database({
      /**
       * Fetch initial document state.
       *
       * Phase 4 stub: returns null so Hocuspocus initializes an empty
       * Y.Doc. Phase 5 will implement an HTTP GET call to
       * WEB_APP_BASE_URL/api/blockdocs/<entryId>/state to load the
       * existing BlockDocument.state as the initial Yjs state.
       *
       * Returning null is safe: Hocuspocus creates a fresh Y.Doc and
       * the first client to connect will push its local state into it.
       */
      async fetch({ documentName: _documentName }) {
        // Phase 5 follow-up: fetch initial state from the web app via
        // GET WEB_APP_BASE_URL/api/blockdocs/<entryId>/state
        return null;
      },

      /**
       * Persist document state after debounced changes and on disconnect.
       *
       * Delegates to the persist module which POSTs to the web app's
       * internal persist endpoint with the CRDT_PERSIST_SECRET header.
       */
      async store(data) {
        await persistDocument({
          documentName: data.documentName,
          state: data.state,
          context: data.lastContext,
        });
      },
    }),
  ],
});

// The health server runs on a separate port (PORT+1) so the main
// Hocuspocus port handles only WebSocket traffic. This is the simpler
// approach compared to hooking into Hocuspocus's onRequest extension,
// which is designed for WebSocket upgrades rather than plain HTTP health
// checks. Dokploy / Docker HEALTHCHECK hits this port.
startHealthServer(HEALTH_PORT, server);

server.listen();
