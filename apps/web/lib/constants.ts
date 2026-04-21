/**
 * Barrel re-export from @ascend/core.
 *
 * All gamification constants, horizon hierarchy rules, category presets,
 * and level math now live in @ascend/core. This file preserves the
 * existing import surface (`from "@/lib/constants"`) so that no
 * consumers need to be rewritten.
 */
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
} from "@ascend/core";
