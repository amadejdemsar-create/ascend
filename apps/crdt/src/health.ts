/**
 * Health check HTTP server for the CRDT app.
 *
 * Runs on a separate port (main port + 1) because the Hocuspocus
 * server's main port handles WebSocket upgrade traffic. Docker
 * HEALTHCHECK and Dokploy monitoring hit GET /healthz on this port.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Server } from "@hocuspocus/server";

/**
 * Start a lightweight HTTP health server.
 *
 * Accepts a Hocuspocus Server instance and reports the active
 * connection count via server.hocuspocus.getConnectionsCount().
 */
export function startHealthServer(
  port: number,
  hocuspocusServer?: Server,
): void {
  const httpServer = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      if (req.method === "GET" && req.url === "/healthz") {
        let connections = 0;
        if (hocuspocusServer) {
          try {
            connections = hocuspocusServer.hocuspocus.getConnectionsCount();
          } catch {
            // Fallback in case the API changes
            connections = 0;
          }
        }

        const body = JSON.stringify({
          ok: true,
          uptime: process.uptime(),
          connections,
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(body);
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    },
  );

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[crdt:health] health server listening on :${port}`);
  });
}
