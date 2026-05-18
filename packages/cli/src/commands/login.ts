/**
 * `ascend login`
 *
 * Interactive: prompts for an API key (input hidden) + base URL,
 * validates via `GET /api/auth/me`, and persists to
 * `~/.ascend/config.json` (mode 0600).
 *
 * Non-interactive (CI / scripts): if `--api-key <key>` and/or
 * `--base-url <url>` are passed as flags, those values are used without
 * a prompt. The flag-only mode lets `ascend login --api-key $KEY` work
 * from a Dokploy boot script or test harness.
 *
 * On 401: prints "Invalid API key" and exits 1.
 * On network failure: prints the network error and exits 3.
 */

import { Command } from "commander";
import pc from "picocolors";

import { DEFAULT_BASE_URL } from "../auth.js";
import { saveConfig, loadConfig } from "../config.js";
import { makeClient } from "../client.js";
import { ApiCallError, CliUsageError, MissingAuthError, wrapUnknown } from "../errors.js";

interface MeResponse {
  user: { id: string; email: string | null; name: string | null };
  workspaceId: string;
}

interface ParentOpts {
  apiKey?: string;
  baseUrl?: string;
}

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description(
      "Prompt for an Ascend API key, validate against the endpoint, and persist it to ~/.ascend/config.json.",
    )
    .action(async () => {
      const parent = program.opts<ParentOpts>();
      const existing = loadConfig();

      // Base URL: prefer global flag, then env, then prompt. Empty
      // string env values are treated as "not set" (handled by the
      // truthy fallback chain below).
      const envBaseUrl = process.env.ASCEND_BASE_URL?.trim() || undefined;
      let baseUrl: string;
      if (parent.baseUrl) baseUrl = parent.baseUrl.trim();
      else if (envBaseUrl) baseUrl = envBaseUrl;
      else {
        // Lazy-load @inquirer/prompts only when we actually need an
        // interactive prompt. Saves ~150ms on `ascend login --api-key`
        // non-interactive runs and on `ascend --help`.
        const { input } = await import("@inquirer/prompts");
        const prompted = await input({
          message: "Ascend endpoint:",
          default: existing?.baseUrl ?? DEFAULT_BASE_URL,
        });
        baseUrl = prompted.trim();
      }

      // API key: prefer global flag, then env, then hidden prompt.
      // Never log the resolved value.
      const envApiKey = process.env.ASCEND_API_KEY?.trim() || undefined;
      let apiKey: string;
      if (parent.apiKey) apiKey = parent.apiKey.trim();
      else if (envApiKey) apiKey = envApiKey;
      else {
        const { password } = await import("@inquirer/prompts");
        apiKey = (
          await password({
            message: "Ascend API key:",
            mask: "*",
            validate: (v) => v.trim().length > 0 || "API key cannot be empty",
          })
        ).trim();
      }

      // Validate by calling /api/auth/me with the proposed creds. We
      // do this BEFORE persisting so an invalid key never lands on disk.
      const client = makeClient({
        apiKey,
        baseUrl: baseUrl.replace(/\/+$/, ""),
        apiKeySource: "flag",
        baseUrlSource: "flag",
      });

      let me: MeResponse;
      try {
        me = await client.get<MeResponse>("/api/auth/me");
      } catch (err) {
        const cliErr = wrapUnknown(err);
        if (cliErr instanceof ApiCallError && cliErr.status === 401) {
          // Re-raise as a usage error so the top-level dispatcher in
          // cli.ts handles the message + exit code. Avoids bypassing
          // wrapUnknown's normalization path with a direct process.exit.
          throw new CliUsageError(
            `Invalid API key. Generate a new one at ${baseUrl}/settings.`,
            "api-key",
          );
        }
        throw cliErr;
      }

      saveConfig({
        apiKey,
        baseUrl: baseUrl.replace(/\/+$/, ""),
        workspaceId: me.workspaceId,
      });

      const who = me.user.email ?? me.user.name ?? me.user.id;
      process.stdout.write(
        `${pc.green("✓")} Logged in as ${pc.bold(who)} on ${pc.dim(baseUrl)}\n`,
      );
    });
}

// Re-export the MissingAuthError so the top-level dispatcher can
// import it without reaching into ../errors. Cosmetic only.
export { MissingAuthError };
