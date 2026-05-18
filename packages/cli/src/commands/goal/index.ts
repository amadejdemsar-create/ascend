/**
 * `ascend goal` namespace.
 *
 * Aggregates the 3 goal subcommands (list, show, progress) under a
 * single `goal` parent command.
 */

import { Command } from "commander";

import { buildGoalListCommand } from "./list.js";
import { buildGoalShowCommand } from "./show.js";
import { buildGoalProgressCommand } from "./progress.js";

export function registerGoalCommands(program: Command): void {
  const goal = new Command("goal").description(
    "Manage goals: list, show detail, log progress.",
  );
  goal.addCommand(buildGoalListCommand(program));
  goal.addCommand(buildGoalShowCommand(program));
  goal.addCommand(buildGoalProgressCommand(program));
  program.addCommand(goal);
}
