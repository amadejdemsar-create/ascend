/**
 * Persistent CLI config at `~/.ascend/config.json`.
 *
 * Stores the API key, base URL, and (optionally) the cached workspace
 * id between commands. Created on `ascend login`, removed on
 * `ascend logout`, and read by `resolveAuth` as the last fallback
 * after flags + env vars.
 *
 * Security:
 *   - File permission MUST be 0600 (owner read+write only).
 *   - Parent directory MUST be 0700 (owner-only access).
 *   - We never log the file contents or the API key (DZ-CLI-1).
 *   - Treat as you would `~/.aws/credentials` or `~/.netrc`.
 */

import { mkdirSync, readFileSync, unlinkSync, writeFileSync, statSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface CliConfig {
  /** Bearer token used as `Authorization: Bearer <apiKey>`. */
  apiKey: string;
  /** Base URL of the Ascend deployment. */
  baseUrl: string;
  /** Optional cached workspace id; refreshed via `ascend whoami --refresh`. */
  workspaceId?: string;
  /** ISO timestamp of last successful save. Used by `ascend whoami` for display. */
  savedAt?: string;
}

const CONFIG_DIR_MODE = 0o700;
const CONFIG_FILE_MODE = 0o600;

/** Absolute path to ~/.ascend/config.json. */
export function configPath(): string {
  return join(homedir(), ".ascend", "config.json");
}

/**
 * Load the config file. Returns null if it does not exist or cannot be
 * parsed. Throws (sync, propagated) only for unexpected I/O errors.
 *
 * Permission check: if the file exists but is world-readable, warn on
 * stderr. The CLI continues to use the config but the user should fix
 * permissions (chmod 600). We do not auto-fix in case the user has
 * deliberate group-readable config in a multi-account setup.
 */
export function loadConfig(): CliConfig | null {
  const path = configPath();
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") return null;
    throw err;
  }

  // Permission audit (best-effort; non-blocking).
  try {
    const s = statSync(path);
    const mode = s.mode & 0o777;
    if (mode & 0o077) {
      process.stderr.write(
        `[ascend] warning: ${path} has mode ${mode.toString(8).padStart(3, "0")}; expected 600. Run: chmod 600 ${path}\n`,
      );
    }
  } catch {
    /* silent: stat failures shouldn't block reading the config */
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "apiKey" in parsed &&
      "baseUrl" in parsed
    ) {
      const c = parsed as Record<string, unknown>;
      if (typeof c.apiKey !== "string" || typeof c.baseUrl !== "string") {
        return null;
      }
      return {
        apiKey: c.apiKey,
        baseUrl: c.baseUrl,
        workspaceId:
          typeof c.workspaceId === "string" ? c.workspaceId : undefined,
        savedAt:
          typeof c.savedAt === "string" ? c.savedAt : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write the config file with 0600 permission, creating the parent
 * directory with 0700 if missing. Overwrites any existing file
 * atomically (write-then-rename would be safer, but the failure mode
 * is recoverable — `ascend login` again — so we keep it simple).
 *
 * Sets `savedAt` to now on every write.
 */
export function saveConfig(cfg: Omit<CliConfig, "savedAt">): void {
  const path = configPath();
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: CONFIG_DIR_MODE });
  // Re-assert directory mode in case the dir already existed with a
  // looser permission. mkdirSync(mode) only applies on creation.
  try {
    chmodSync(dir, CONFIG_DIR_MODE);
  } catch {
    /* if we can't chmod the dir we still try to write the file */
  }

  const next: CliConfig = {
    ...cfg,
    savedAt: new Date().toISOString(),
  };
  // Pretty-print so the user can inspect the file if they want.
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, {
    mode: CONFIG_FILE_MODE,
  });
  // mode option is honored only on file creation; re-assert via chmod
  // so an existing file's permissions are tightened on overwrite.
  chmodSync(path, CONFIG_FILE_MODE);
}

/**
 * Delete the config file. Returns true if a file was removed, false if
 * it did not exist. Never throws on ENOENT.
 */
export function clearConfig(): boolean {
  const path = configPath();
  try {
    unlinkSync(path);
    return true;
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") return false;
    throw err;
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error &&
    typeof (err as NodeJS.ErrnoException).code === "string"
  );
}
