/**
 * `ascend calendar` namespace.
 *
 * Aggregates the 3 calendar subcommands (day, week, agenda).
 */

import { Command } from "commander";

import { buildCalendarDayCommand } from "./day.js";
import { buildCalendarWeekCommand } from "./week.js";
import { buildCalendarAgendaCommand } from "./agenda.js";

export function registerCalendarCommands(program: Command): void {
  const calendar = new Command("calendar").description(
    "Calendar views: day, week, and flat agenda.",
  );
  calendar.addCommand(buildCalendarDayCommand(program));
  calendar.addCommand(buildCalendarWeekCommand(program));
  calendar.addCommand(buildCalendarAgendaCommand(program));
  program.addCommand(calendar);
}
