// Horizon hierarchy rules
// Valid parent horizon for each child horizon
// null means the horizon has no parent (top-level)
export const VALID_PARENT_HORIZONS: Record<string, string | null> = {
  YEARLY: null,
  QUARTERLY: "YEARLY",
  MONTHLY: "QUARTERLY",
  WEEKLY: "MONTHLY",
};

// Ordered hierarchy for display and validation
export const HORIZON_ORDER = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] as const;

// XP values per horizon (used in Phase 9 gamification, defined here for schema consistency)
export const XP_PER_HORIZON: Record<string, number> = {
  YEARLY: 500,
  QUARTERLY: 200,
  MONTHLY: 100,
  WEEKLY: 50,
};

// Priority multipliers for XP
export const PRIORITY_MULTIPLIER: Record<string, number> = {
  LOW: 0.5,
  MEDIUM: 1.0,
  HIGH: 1.5,
};
