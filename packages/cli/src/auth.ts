/**
 * Auth resolution chain for the Ascend CLI.
 *
 * Resolves the API key and base URL used by every command from a
 * 4-step chain. The first hit wins:
 *
 *   apiKey:
 *     1. --api-key <key> flag
 *     2. ASCEND_API_KEY env var
 *     3. ~/.ascend/config.json `.apiKey`
 *     4. (none) → throws MissingAuthError
 *
 *   baseUrl:
 *     1. --base-url <url> flag
 *     2. ASCEND_BASE_URL env var
 *     3. ~/.ascend/config.json `.baseUrl`
 *     4. hardcoded default `DEFAULT_BASE_URL`
 *
 * The cached workspace id (when present in the config file) is also
 * returned so commands that need it can avoid an extra round-trip.
 */

import { loadConfig } from "./config.js";
import { MissingAuthError } from "./errors.js";

export const DEFAULT_BASE_URL = "https://ascend.nativeai.agency";

export interface ResolveAuthOptions {
  /** From `--api-key <key>` flag, if any. */
  flagApiKey?: string;
  /** From `--base-url <url>` flag, if any. */
  flagBaseUrl?: string;
}

export interface ResolvedAuth {
  apiKey: string;
  baseUrl: string;
  /** Source of the apiKey, used by `ascend whoami`. */
  apiKeySource: "flag" | "env" | "config";
  /** Source of the baseUrl, used by `ascend whoami`. */
  baseUrlSource: "flag" | "env" | "config" | "default";
  /** Cached workspace id from config, if any. */
  workspaceId?: string;
}

/**
 * Resolve auth + endpoint per the chain above. Throws MissingAuthError
 * when no apiKey is found in any source.
 */
export function resolveAuth(opts: ResolveAuthOptions = {}): ResolvedAuth {
  const config = loadConfig();

  // ---- apiKey ----
  let apiKey: string | undefined;
  let apiKeySource: ResolvedAuth["apiKeySource"] | undefined;
  if (opts.flagApiKey) {
    apiKey = opts.flagApiKey;
    apiKeySource = "flag";
  } else if (process.env.ASCEND_API_KEY) {
    apiKey = process.env.ASCEND_API_KEY;
    apiKeySource = "env";
  } else if (config?.apiKey) {
    apiKey = config.apiKey;
    apiKeySource = "config";
  }
  if (!apiKey || !apiKeySource) {
    throw new MissingAuthError();
  }

  // ---- baseUrl ----
  let baseUrl: string;
  let baseUrlSource: ResolvedAuth["baseUrlSource"];
  if (opts.flagBaseUrl) {
    baseUrl = opts.flagBaseUrl;
    baseUrlSource = "flag";
  } else if (process.env.ASCEND_BASE_URL) {
    baseUrl = process.env.ASCEND_BASE_URL;
    baseUrlSource = "env";
  } else if (config?.baseUrl) {
    baseUrl = config.baseUrl;
    baseUrlSource = "config";
  } else {
    baseUrl = DEFAULT_BASE_URL;
    baseUrlSource = "default";
  }

  // Normalize trailing slash so path joins don't double-slash.
  baseUrl = baseUrl.replace(/\/+$/, "");

  return {
    apiKey,
    baseUrl,
    apiKeySource,
    baseUrlSource,
    workspaceId: config?.workspaceId,
  };
}

/**
 * Privacy helper for display surfaces (whoami, error logs).
 * Returns "abcd1234…wxyz" given a long API key. Never prints the full
 * key. Used by `ascend whoami` and any future surface that wants to
 * show "you are logged in" without exposing the secret.
 */
export function fingerprintApiKey(apiKey: string): string {
  if (apiKey.length < 12) return "•".repeat(8);
  return `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;
}
