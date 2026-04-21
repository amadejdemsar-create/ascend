export {
  // Enum objects (mirror Prisma shape)
  Horizon,
  GoalStatus,
  Priority,
  RecurringFrequency,
  TodoStatus,
  // Enum types
  type Horizon as HorizonType,
  type GoalStatus as GoalStatusType,
  type Priority as PriorityType,
  type RecurringFrequency as RecurringFrequencyType,
  type TodoStatus as TodoStatusType,
  // Zod-compatible tuples
  HORIZON_VALUES,
  STATUS_VALUES,
  PRIORITY_VALUES,
  RECURRING_FREQUENCY_VALUES,
  TODO_STATUS_VALUES,
  // MCP JSON Schema arrays
  HORIZON_ENUM,
  STATUS_ENUM,
  PRIORITY_ENUM,
  TODO_STATUS_ENUM,
} from "./enums";

export {
  VALID_PARENT_HORIZONS,
  HORIZON_ORDER,
  XP_PER_HORIZON,
  PRIORITY_MULTIPLIER,
  XP_PER_TODO,
  xpForLevel,
  levelFromXp,
  xpToNextLevel,
  CATEGORY_COLORS,
  DEFAULT_CATEGORIES,
} from "./gamification";
