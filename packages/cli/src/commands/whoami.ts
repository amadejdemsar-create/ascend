/**
 * `ascend whoami`
 *
 * Resolves auth via the standard chain (flag -> env -> config), calls
 * `GET /api/auth/me` + `GET /api/workspaces`, and prints:
 *
 *   user        : <email> (or name, or id fallback)
 *   workspace   : <name>  (auth-resolved workspaceId resolves to one entry)
 *   endpoint    : <baseUrl>
 *   api key     : <fingerprint>  (8 leading + 4 trailing chars)
 *   sources     : api-key=<source>, base-url=<source>
 *
 * Useful for diagnosing "is this CLI hitting the right account on the
 * right endpoint?" without exposing the full key.
 *
 * `--json` outputs the same data as a flat JSON object for scripting.
 * `--refresh` re-fetches the workspace id and writes it back to the
 * config file so the next command can skip the network call.
 */

import { Command } from "commander";
import pc from "picocolors";

import { fingerprintApiKey, resolveAuth } from "../auth.js";
import { makeClient } from "../client.js";
import { saveConfig } from "../config.js";

interface MeResponse {
  user: { id: string; email: string | null; name: string | null };
  workspaceId: string;
}

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

interface WhoamiOpts {
  json?: boolean;
  refresh?: boolean;
}

interface ParentOpts {
  apiKey?: string;
  baseUrl?: string;
}

export function registerWhoamiCommand(program: Command): void {
  program
    .command("whoami")
    .description("Show the resolved Ascend account + endpoint for this CLI.")
    .option("--json", "Output JSON instead of pretty text.")
    .option(
      "--refresh",
      "Re-fetch the workspace id from the server and update the local config.",
    )
    .action(async (opts: WhoamiOpts) => {
      const parent = program.opts<ParentOpts>();
      const auth = resolveAuth({
        flagApiKey: parent.apiKey,
        flagBaseUrl: parent.baseUrl,
      });
      const client = makeClient(auth);

      const [me, workspaces] = await Promise.all([
        client.get<MeResponse>("/api/auth/me"),
        client.get<WorkspaceItem[]>("/api/workspaces"),
      ]);

      const activeWorkspace =
        workspaces.find((w) => w.id === me.workspaceId) ?? workspaces[0];

      // Optionally persist the resolved workspaceId so subsequent
      // commands can read it from the config file instead of hitting
      // the network again. Only does this when the auth chain pulled
      // from the config file (the canonical "I have a saved session"
      // path); never overwrites a config when the user is running
      // ad-hoc via env vars.
      if (opts.refresh && auth.apiKeySource === "config") {
        saveConfig({
          apiKey: auth.apiKey,
          baseUrl: auth.baseUrl,
          workspaceId: me.workspaceId,
        });
      }

      const fingerprint = fingerprintApiKey(auth.apiKey);
      const userLabel = me.user.email ?? me.user.name ?? me.user.id;

      if (opts.json) {
        process.stdout.write(
          `${JSON.stringify(
            {
              user: me.user,
              workspaceId: me.workspaceId,
              workspaceName: activeWorkspace?.name ?? null,
              endpoint: auth.baseUrl,
              apiKeyFingerprint: fingerprint,
              apiKeySource: auth.apiKeySource,
              baseUrlSource: auth.baseUrlSource,
            },
            null,
            2,
          )}\n`,
        );
        return;
      }

      const lines = [
        `${pc.dim("user".padEnd(11))} ${pc.bold(userLabel)}`,
        `${pc.dim("workspace".padEnd(11))} ${
          activeWorkspace?.name ?? pc.dim("(unknown)")
        }`,
        `${pc.dim("endpoint".padEnd(11))} ${auth.baseUrl}`,
        `${pc.dim("api key".padEnd(11))} ${fingerprint}`,
        `${pc.dim("sources".padEnd(11))} ${pc.dim(
          `api-key=${auth.apiKeySource}, base-url=${auth.baseUrlSource}`,
        )}`,
      ];
      process.stdout.write(`${lines.join("\n")}\n`);
    });
}
