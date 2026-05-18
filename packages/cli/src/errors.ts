/**
 * Typed errors for the Ascend CLI. Each carries an exit code that the
 * top-level handler in `cli.ts` translates into `process.exit(code)`.
 *
 * Exit codes (per PRD):
 *   0  success
 *   1  user error (missing auth, bad arguments, validation)
 *   2  server error (4xx / 5xx from /api/*)
 *   3  network error (DNS, refused, timeout)
 *
 * Conventions:
 *   - Every CLI-thrown error inherits from CliError so the dispatcher
 *     can branch on `err instanceof CliError`.
 *   - `message` is user-facing. Do NOT include secrets or full payloads.
 *   - Wrap raw thrown values via `wrapUnknown(err)` so the dispatcher
 *     always sees a CliError.
 */

export type CliExitCode = 0 | 1 | 2 | 3;

export abstract class CliError extends Error {
  /** Exit code to propagate via process.exit. */
  readonly exitCode: CliExitCode;

  constructor(message: string, exitCode: CliExitCode) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

/**
 * Auth could not be resolved from flags, env, or the config file.
 * Recovery path: `ascend login` or `export ASCEND_API_KEY=...`.
 */
export class MissingAuthError extends CliError {
  constructor() {
    super(
      "Not logged in. Run `ascend login` to set your API key, or export ASCEND_API_KEY in your shell.",
      1,
    );
  }
}

/**
 * The user passed a flag / arg that did not validate.
 * `field` is the option name (e.g., "horizon"); used only for nicer formatting.
 */
export class CliUsageError extends CliError {
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message, 1);
    this.field = field;
  }
}

/**
 * The HTTP API returned a 4xx or 5xx. Carries the original status code
 * for log lines but maps to exit code 2 always.
 */
export class ApiCallError extends CliError {
  readonly status: number;
  readonly path: string;
  readonly body?: unknown;
  constructor(args: {
    status: number;
    path: string;
    message: string;
    body?: unknown;
  }) {
    super(`${args.status} on ${args.path}: ${args.message}`, 2);
    this.status = args.status;
    this.path = args.path;
    this.body = args.body;
  }
}

/**
 * The HTTP request failed before getting a response (DNS, refused,
 * abort, etc.). Distinct from ApiCallError because the recovery path
 * is usually "check your connectivity or ASCEND_BASE_URL", not "look
 * at the server response."
 */
export class NetworkError extends CliError {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(`Network error: ${message}`, 3);
    this.cause = cause;
  }
}

/**
 * Wrap an arbitrary thrown value into a CliError so the dispatcher can
 * uniformly extract message + exitCode. Used by the top-level catch
 * in cli.ts and by every command handler that catches `unknown`.
 */
export function wrapUnknown(err: unknown): CliError {
  if (err instanceof CliError) return err;
  if (err instanceof Error) {
    // Heuristic: fetch's TypeError on network failure
    if (err.name === "TypeError" && /fetch failed|network/i.test(err.message)) {
      return new NetworkError(err.message, err);
    }
    return new CliUsageError(err.message);
  }
  return new CliUsageError(String(err));
}
