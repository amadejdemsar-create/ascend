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

// Level formula functions (quadratic: 100 * level^2)
// Level 1 = 100 XP, Level 2 = 400 XP, Level 5 = 2500 XP
export function xpForLevel(level: number): number {
  return 100 * level * level;
}

export function levelFromXp(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100));
}

export function xpToNextLevel(totalXp: number): {
  current: number;
  needed: number;
  percentage: number;
} {
  const currentLevel = levelFromXp(totalXp);
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const xpIntoLevel = totalXp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  return {
    current: xpIntoLevel,
    needed: xpNeeded,
    percentage: xpNeeded > 0 ? Math.round((xpIntoLevel / xpNeeded) * 100) : 0,
  };
}

// Category color presets
export const CATEGORY_COLORS = [
  { value: "#4F46E5", label: "Indigo" },
  { value: "#8B5CF6", label: "Violet" },
  { value: "#10B981", label: "Emerald" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#06B6D4", label: "Cyan" },
  { value: "#EC4899", label: "Pink" },
  { value: "#6B7280", label: "Gray" },
] as const;

// Default categories seeded for new users
export const DEFAULT_CATEGORIES = [
  { name: "Business", color: "#4F46E5", icon: "briefcase", sortOrder: 0 },
  { name: "Personal", color: "#8B5CF6", icon: "user", sortOrder: 1 },
  { name: "Health", color: "#10B981", icon: "heart-pulse", sortOrder: 2 },
  { name: "Finance", color: "#F59E0B", icon: "wallet", sortOrder: 3 },
  { name: "Learning", color: "#06B6D4", icon: "book-open", sortOrder: 4 },
] as const;
