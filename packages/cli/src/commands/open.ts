/**
 * `ascend open [route]` — launch the Ascend web app at a given path.
 *
 * Without an argument: opens the resolved baseUrl. With an argument:
 * opens `${baseUrl}/${route}`. Leading slashes on the route are
 * tolerated; query strings are passed through verbatim.
 *
 * Uses the cross-platform `open` package (lazy-loaded inside the
 * action so `ascend --help` doesn't pay its startup cost) which
 * dispatches to `open` on macOS, `xdg-open` on Linux, `start` on
 * Windows.
 *
 * No auth required. The command resolves only the base URL (flag →
 * env → config → default), so a user who hasn't run `ascend login`
 * can still use `ascend open todos` to jump to the web app's home
 * page. The browser handles its own session cookie auth.
 */

import { Command } from "commander";
import pc from "picocolors";

import { DEFAULT_BASE_URL } from "../auth.js";
import { loadConfig } from "../config.js";

interface OpenOpts {
  print?: boolean;
}

interface ParentOpts {
  baseUrl?: string;
}

/**
 * Resolve only the base URL, without requiring an API key. Skips the
 * full `resolveAuth` chain so users who haven't logged in can still
 * use `ascend open` as a browser launcher.
 *
 * Resolution order: flag → env → config → hardcoded default. Same
 * order as `resolveAuth` but only on the baseUrl half.
 */
function resolveBaseUrl(flagBaseUrl?: string): string {
  if (flagBaseUrl?.trim()) return flagBaseUrl.trim();
  const env = process.env.ASCEND_BASE_URL?.trim();
  if (env) return env;
  const cfg = loadConfig();
  if (cfg?.baseUrl) return cfg.baseUrl;
  return DEFAULT_BASE_URL;
}

export function registerOpenCommand(program: Command): void {
  program
    .command("open")
    .description("Open the Ascend web app at the given path in your default browser.")
    .argument("[route]", 'Path within the web app, e.g. "todos", "goals/<id>". Default: home page.')
    .option(
      "--print",
      "Print the URL instead of launching the browser. Useful for piping into curl, qrencode, etc.",
    )
    .action(async (route: string | undefined, opts: OpenOpts) => {
      const parent = program.opts<ParentOpts>();
      const baseUrl = resolveBaseUrl(parent.baseUrl);

      const cleanedBase = baseUrl.replace(/\/+$/, "");
      const cleanedRoute = (route ?? "").replace(/^\/+/, "");
      const url = cleanedRoute ? `${cleanedBase}/${cleanedRoute}` : cleanedBase;

      if (opts.print) {
        process.stdout.write(`${url}\n`);
        return;
      }

      // Lazy-load the cross-platform `open` package: it's ~150KB
      // resolved and only used here. Saves startup time on every other
      // command.
      const { default: open } = await import("open");
      process.stdout.write(`${pc.dim("→")} Opening ${pc.cyan(url)}\n`);
      await open(url);
    });
}
