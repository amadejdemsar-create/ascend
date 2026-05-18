/**
 * `ascend todo done <id-or-prefix>` — mark a todo complete.
 *
 * Accepts any leading substring of a todo id. If the prefix matches
 * multiple todos, the command lists them and exits 1 so the user can
 * disambiguate. If it matches zero, the command exits 1 with a hint.
 *
 * Calls POST /api/todos/<id>/complete. Emits a single confetti emoji
 * (🎉) on success, suppressed when NO_COLOR is set.
 */

import { Command } from "commander";
import pc from "picocolors";

import { resolveAuth } from "../../auth.js";
import { makeClient } from "../../client.js";
import { resolveIdPrefix } from "../../lib/resolve-id.js";
import { renderRecord, resolveOutputMode, truncate } from "../../lib/output.js";

interface TodoRow {
  id: string;
  title: string;
  status: string;
  completedAt: string | null;
}

interface DoneOpts {
  json?: boolean;
  md?: boolean;
}

const NO_COLOR = process.env.NO_COLOR === "1" || process.env.NO_COLOR === "true";

export function buildTodoDoneCommand(parent: Command): Command {
  return new Command("done")
    .description("Mark a todo complete.")
    .argument("<id>", "Full or prefix id of the todo to complete.")
    .option("--json", "Output JSON.")
    .option("--md", "Output markdown.")
    .action(async (idOrPrefix: string, opts: DoneOpts) => {
      const parentOpts = parent.opts<{ apiKey?: string; baseUrl?: string }>();
      const auth = resolveAuth({
        flagApiKey: parentOpts.apiKey,
        flagBaseUrl: parentOpts.baseUrl,
      });
      const client = makeClient(auth);

      // Pull pending todos (the only ones eligible for "done") so the
      // prefix resolver has a small candidate set.
      const candidates = await client.get<TodoRow[]>(
        "/api/todos?status=PENDING",
      );
      const target = resolveIdPrefix({
        query: idOrPrefix,
        candidates,
        label: "todo",
      });

      const completed = await client.post<TodoRow>(
        `/api/todos/${target.id}/complete`,
      );

      renderRecord({
        mode: resolveOutputMode(opts),
        row: completed,
        pretty: (t) => {
          const prefix = NO_COLOR ? "Done:" : `${pc.green("🎉")} Done:`;
          return `${prefix} ${pc.bold(truncate(t.title, 60))}`;
        },
        md: (t) => `- [x] **${t.title}** · completed`,
      });
    });
}
