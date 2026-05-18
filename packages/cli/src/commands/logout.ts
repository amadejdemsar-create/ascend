/**
 * `ascend logout`
 *
 * Deletes `~/.ascend/config.json` after a confirmation prompt. The
 * Ascend account itself is untouched; this only removes the local
 * credentials so future commands fall back to env vars or fail with
 * MissingAuthError.
 *
 * `--yes` flag skips the confirmation for scripts.
 */

import { Command } from "commander";
import pc from "picocolors";

import { clearConfig, configPath, loadConfig } from "../config.js";

interface LogoutOpts {
  yes?: boolean;
}

export function registerLogoutCommand(program: Command): void {
  program
    .command("logout")
    .description("Delete ~/.ascend/config.json. Your Ascend account is untouched.")
    .option("-y, --yes", "Skip the confirmation prompt.")
    .action(async (opts: LogoutOpts) => {
      const existing = loadConfig();
      if (!existing) {
        process.stdout.write(
          `${pc.dim("Already logged out.")} (no config at ${configPath()})\n`,
        );
        return;
      }

      if (!opts.yes) {
        // Lazy: @inquirer/prompts is the biggest single dep in the
        // bundle; only load it when we actually need to prompt.
        const { confirm } = await import("@inquirer/prompts");
        const proceed = await confirm({
          message: `Delete ${configPath()}?`,
          default: true,
        });
        if (!proceed) {
          process.stdout.write(`${pc.dim("Cancelled.")}\n`);
          return;
        }
      }

      const removed = clearConfig();
      if (removed) {
        process.stdout.write(`${pc.green("✓")} Logged out.\n`);
      } else {
        process.stdout.write(
          `${pc.dim("Nothing to do.")} (config already removed)\n`,
        );
      }
    });
}
