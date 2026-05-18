/**
 * `ascend open [route]` — launch the Ascend web app at a given path.
 *
 * Without an argument: opens the resolved baseUrl. With an argument:
 * opens `${baseUrl}/${route}`. Leading slashes on the route are
 * tolerated; query strings are passed through verbatim.
 *
 * Uses the cross-platform `open` package which dispatches to `open` on
 * macOS, `xdg-open` on Linux, and `start` on Windows.
 *
 * Note: no auth headers are sent — this just launches the user's
 * default browser at the URL. The web app handles its own
 * authentication via cookies (you must already be logged into the web
 * app for the page to render).
 */

import { Command } from "commander";
import open from "open";
import pc from "picocolors";

import { resolveAuth } from "../auth.js";

interface OpenOpts {
  print?: boolean;
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
      const parent = program.opts<{ apiKey?: string; baseUrl?: string }>();
      // We only need the baseUrl, but resolveAuth checks that the user
      // has a configured Ascend account. That's the right behavior:
      // calling `ascend open todos` from a clean shell should explain
      // they need to run `ascend login` first.
      const auth = resolveAuth({
        flagApiKey: parent.apiKey,
        flagBaseUrl: parent.baseUrl,
      });

      const cleanedBase = auth.baseUrl.replace(/\/+$/, "");
      const cleanedRoute = (route ?? "").replace(/^\/+/, "");
      const url = cleanedRoute ? `${cleanedBase}/${cleanedRoute}` : cleanedBase;

      if (opts.print) {
        process.stdout.write(`${url}\n`);
        return;
      }

      process.stdout.write(`${pc.dim("→")} Opening ${pc.cyan(url)}\n`);
      await open(url);
    });
}
