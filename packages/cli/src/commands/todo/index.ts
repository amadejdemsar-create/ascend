/**
 * `ascend todo` namespace registration.
 *
 * Aggregates the 4 todo subcommands (add, list, done, big3) under a
 * single `todo` parent command so users get `ascend todo add ...`
 * etc. Each subcommand keeps its own action handler.
 */

import { Command } from "commander";

import { buildTodoAddCommand } from "./add.js";
import { buildTodoListCommand } from "./list.js";
import { buildTodoDoneCommand } from "./done.js";
import { buildTodoBig3Command } from "./big3.js";

export function registerTodoCommands(program: Command): void {
  const todo = new Command("todo").description(
    "Manage todos: add, list, complete, and set Big 3 priorities.",
  );
  todo.addCommand(buildTodoAddCommand(program));
  todo.addCommand(buildTodoListCommand(program));
  todo.addCommand(buildTodoDoneCommand(program));
  todo.addCommand(buildTodoBig3Command(program));
  program.addCommand(todo);
}
