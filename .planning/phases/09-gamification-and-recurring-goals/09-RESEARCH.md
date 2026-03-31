# Phase 9: Gamification and Recurring Goals - Research

**Researched:** 2026-03-30
**Domain:** Gamification systems (XP/levels/streaks), recurring goal patterns, celebration animations
**Confidence:** HIGH

## Summary

Phase 9 adds gamification mechanics and recurring goals to Ascend. The project is already well prepared: the Prisma schema includes `UserStats` and `XpEvent` tables (deployed in the init migration), `lib/constants.ts` defines `XP_PER_HORIZON` and `PRIORITY_MULTIPLIER` values, and the dashboard service already returns XP/level/streak data from UserStats with safe zero defaults. The streaks stats widget currently shows only basic stats (completed this month, completion rate, total goals, total completed) and explicitly defers XP/level/streak display to Phase 9 (per the 04-03 decision log).

The core work is: (1) a gamification service that awards XP on goal completion, computes levels, tracks streaks, and calculates weekly score; (2) a schema extension for recurring goals (template + generated instances with streak tracking); (3) updating the dashboard widget to show gamification data; and (4) celebration animations using canvas-confetti for milestones and CSS transitions for progress bars.

**Primary recommendation:** Build a `gamification-service.ts` that hooks into the goal completion flow (both API route and MCP tools), use the template+instance pattern for recurring goals (new `RecurringConfig` model on Goal), and use `canvas-confetti` (standalone, no React wrapper needed) for celebration effects.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAME-01 | Each goal completion awards XP based on horizon level and priority | XP_PER_HORIZON and PRIORITY_MULTIPLIER already defined in constants.ts. Gamification service computes `XP_PER_HORIZON[horizon] * PRIORITY_MULTIPLIER[priority]` and writes to XpEvent + UserStats tables. |
| GAME-02 | User has a level that increases as XP accumulates, with level-up celebration animation | Quadratic formula `XP_FOR_LEVEL = 100 * level^2` provides progressive curve. Level-up detected by comparing before/after levels on XP award. canvas-confetti fires fireworks preset on level-up. |
| GAME-03 | Recurring goals track streaks (consecutive completions without missing) | RecurringConfig model stores frequency/interval. Streak increments on instance completion, resets when a due instance is missed (checked on next instance generation or on dashboard load). |
| GAME-04 | Weekly score aggregates completed goals, streaks maintained, and progress made | Computed from XpEvents in current week window. UserStats.weeklyScore updated on each XP award. weekStartDate resets on Monday boundary. |
| GAME-05 | Satisfying completion animation plays when a goal is marked complete (confetti for milestones, checkmark for tasks) | canvas-confetti for milestone completions (YEARLY/QUARTERLY). CSS checkmark animation for regular completions (MONTHLY/WEEKLY). |
| GAME-06 | Progress bars animate smoothly when progress is added | CSS `transition: width 500ms ease-in-out` on progress bar inner div. Already using Tailwind; add `transition-all duration-500 ease-in-out` classes. |
| GAME-07 | Dashboard displays current level, XP progress to next level, active streaks, and weekly score | Extend StatsData interface and StreaksStatsWidget to show level, XP bar, streak count, and weekly score. Data already flows through dashboard service. |
| GOAL-10 | User can create recurring goals with frequency (daily, weekly, monthly) that auto-generate instances | New fields on Goal model: isRecurring, recurringFrequency (DAILY/WEEKLY/MONTHLY), recurringInterval. Instance generation on dashboard load or via cron-like check. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| canvas-confetti | 1.9.x | Celebration animations (confetti, fireworks) | 6M+ weekly downloads, zero dependencies, 3.5KB gzipped, supports `disableForReducedMotion`, Web Worker offloading. No React wrapper needed; call directly from event handlers. |
| date-fns | 4.x (already installed) | Date calculations for streaks, weekly boundaries, recurring date computation | Already in the project. Functions: `startOfWeek`, `isSameDay`, `differenceInCalendarDays`, `addDays`, `addWeeks`, `addMonths`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Prisma 7 | 7.6.x (already installed) | Database operations for new gamification models | Schema extension for recurring goal fields, new migration |
| Zustand | 5.x (already installed) | Client state for animation triggers | Transient store for "just completed" goal IDs to trigger animations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| canvas-confetti | react-confetti-explosion | CSS-only, lighter, but less customizable for different celebration tiers (no fireworks variant) |
| canvas-confetti | react-canvas-confetti | Adds React wrapper overhead for no real benefit; the raw API is simpler to call from handlers |
| rrule library | Manual date math with date-fns | RRULE is overkill for three fixed frequencies (daily/weekly/monthly). date-fns `addDays`/`addWeeks`/`addMonths` is sufficient and already installed. |
| Separate RecurringGoalTemplate model | Fields on existing Goal model | Separate model adds schema complexity for no benefit. Recurring config as nullable fields on Goal (isRecurring, recurringFrequency, recurringInterval) is simpler and matches the existing "flat fields" pattern. |

**Installation:**
```bash
npm install canvas-confetti
npm install --save-dev @types/canvas-confetti
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── services/
│   ├── gamification-service.ts  # XP award, level calc, streak update, weekly score
│   └── recurring-service.ts     # Instance generation, due date calculation, streak check
├── constants.ts                 # Already has XP_PER_HORIZON, PRIORITY_MULTIPLIER; add LEVEL_FORMULA
├── hooks/
│   └── use-celebrations.ts      # Client hook for triggering confetti/checkmark animations
components/
├── dashboard/
│   └── streaks-stats-widget.tsx  # Extend with XP bar, level display, streak fire icon, weekly score
├── goals/
│   ├── goal-status-select.tsx    # Hook into completion to trigger celebration + XP
│   └── completion-animation.tsx  # Reusable celebration overlay component
└── ui/
    └── xp-progress-bar.tsx       # Animated XP-to-next-level bar
```

### Pattern 1: Gamification Service (Server Side)
**What:** Centralized service that handles all XP/level/streak logic
**When to use:** On every goal status change to COMPLETED (from API route, MCP tool, or bulk complete)

```typescript
// lib/services/gamification-service.ts
import { prisma } from "@/lib/db";
import { XP_PER_HORIZON, PRIORITY_MULTIPLIER } from "@/lib/constants";

function xpForLevel(level: number): number {
  return 100 * level * level; // Level 1 = 100, Level 2 = 400, Level 5 = 2500
}

function levelFromXp(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100));
}

export const gamificationService = {
  async awardXp(userId: string, goalId: string, horizon: string, priority: string) {
    const baseXp = XP_PER_HORIZON[horizon] ?? 50;
    const multiplier = PRIORITY_MULTIPLIER[priority] ?? 1.0;
    const amount = Math.round(baseXp * multiplier);

    // Record the XP event
    await prisma.xpEvent.create({
      data: { userId, amount, source: "goal_completion", goalId },
    });

    // Update UserStats atomically
    const stats = await prisma.userStats.upsert({
      where: { userId },
      create: { userId, totalXp: amount, level: levelFromXp(amount), goalsCompleted: 1 },
      update: {
        totalXp: { increment: amount },
        goalsCompleted: { increment: 1 },
      },
    });

    const newLevel = levelFromXp(stats.totalXp);
    const leveledUp = newLevel > stats.level;

    if (leveledUp) {
      await prisma.userStats.update({
        where: { userId },
        data: { level: newLevel },
      });
    }

    return { amount, totalXp: stats.totalXp, level: newLevel, leveledUp };
  },
};
```

### Pattern 2: Celebration Animation (Client Side)
**What:** Client hook that fires the appropriate animation based on completion context
**When to use:** After a goal status is changed to COMPLETED in the UI

```typescript
// lib/hooks/use-celebrations.ts
import confetti from "canvas-confetti";

export function useCelebrations() {
  function celebrateGoalComplete(horizon: string) {
    if (horizon === "YEARLY" || horizon === "QUARTERLY") {
      // Big celebration: fireworks burst
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        disableForReducedMotion: true,
      });
    }
    // MONTHLY/WEEKLY: handled by CSS checkmark animation, no confetti
  }

  function celebrateLevelUp() {
    // Full screen fireworks
    const duration = 3000;
    const end = Date.now() + duration;
    const interval = setInterval(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        disableForReducedMotion: true,
      });
      if (Date.now() > end) clearInterval(interval);
    }, 250);
  }

  return { celebrateGoalComplete, celebrateLevelUp };
}
```

### Pattern 3: Recurring Goal Instance Generation
**What:** Template goal with recurring config generates child instances on schedule
**When to use:** On dashboard load or periodic check, generate next due instance if none exists

```typescript
// Recurring goal fields on Goal model (schema extension)
// isRecurring: Boolean
// recurringFrequency: RecurringFrequency? (DAILY, WEEKLY, MONTHLY)
// recurringInterval: Int? (default 1, e.g., every 2 weeks)
// currentStreak: Int (default 0)
// longestStreak: Int (default 0)
// lastCompletedInstanceDate: DateTime?
```

### Anti-Patterns to Avoid
- **Awarding XP on the client side:** XP must be computed and persisted server side to prevent manipulation and ensure MCP tool completions also earn XP. The API response should return the XP result so the client can display animations.
- **Using a separate RecurringGoalTemplate table:** Creates unnecessary joins and complexity. Recurring config as nullable fields on the existing Goal model keeps the schema flat and consistent with the project's existing pattern.
- **Generating all future recurring instances at creation time:** Unbounded growth. Generate instances lazily: only create the next due instance when the current one is completed or when the dashboard checks for due instances.
- **Complex RRULE parsing for three fixed frequencies:** The requirement specifies daily, weekly, and monthly. An RRULE library is unnecessary overhead. Simple date-fns arithmetic handles all three cases.
- **Blocking the completion flow with animation logic:** Celebration animations must not block the API call. Fire animations after the mutation succeeds, using the returned response data (leveledUp, horizon) to decide animation type.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confetti/celebration animations | Custom canvas particle system | canvas-confetti | Tested across browsers, handles reduced motion, Web Worker support, customizable particle effects. 3.5KB is negligible. |
| Date arithmetic for recurring goals | Manual day/week/month calculation | date-fns `addDays`/`addWeeks`/`addMonths` | Already installed, handles month boundary edge cases (Feb 28/29, varying month lengths), timezone aware. |
| Progress bar animation | JavaScript requestAnimationFrame loop | CSS `transition: width 500ms ease-in-out` | Browser optimized, GPU accelerated, zero JS overhead. Tailwind classes: `transition-all duration-500 ease-in-out`. |

**Key insight:** The gamification logic itself (XP formulas, level calculation, streak tracking) is domain specific and MUST be hand-rolled since no generic library matches this use case. But the visual effects and date math should use established libraries.

## Common Pitfalls

### Pitfall 1: Double XP Award on Duplicate Completion
**What goes wrong:** If a goal is already COMPLETED and gets "completed" again (e.g., from a re-render or accidental double-click), XP is awarded twice.
**Why it happens:** The goal update endpoint sets completedAt and triggers XP without checking the previous status.
**How to avoid:** In the gamification service, check the goal's previous status before awarding XP. Only award if transitioning FROM a non-completed status TO COMPLETED. The goalService.update already sets completedAt on completion; add a guard that fetches the current status before awarding.
**Warning signs:** XP totals that seem too high, duplicate XpEvent entries for the same goalId.

### Pitfall 2: Streak Reset Timing Edge Case
**What goes wrong:** Streak resets prematurely or doesn't reset when it should because of timezone mismatches.
**Why it happens:** Comparing dates without normalizing to the user's timezone (or at least to UTC day boundaries). A goal completed at 11:59 PM and the next at 12:01 AM could appear as "same day" or "two days apart" depending on how dates are compared.
**How to avoid:** Normalize all streak date comparisons to UTC day boundaries using `startOfDay` from date-fns. For recurring goals, compare `lastCompletedInstanceDate` against the instance's due date, not the current time.
**Warning signs:** Streaks breaking overnight, streaks not incrementing on sequential day completions.

### Pitfall 3: Recurring Instance Over-Generation
**What goes wrong:** Multiple instances of the same recurring goal get generated for the same period.
**Why it happens:** Dashboard loads or multiple API calls trigger instance generation simultaneously without a deduplication check.
**How to avoid:** Before generating a new instance, query for existing incomplete instances of the same recurring parent. Only generate if no pending instance exists. Use a unique constraint or check in the service layer.
**Warning signs:** Multiple identical weekly goals appearing, user confusion about duplicates.

### Pitfall 4: Animation Jank on Goal Completion
**What goes wrong:** The UI freezes briefly when confetti fires because canvas-confetti runs on the main thread.
**Why it happens:** Particle rendering with 100+ particles can cause frame drops on slower devices.
**How to avoid:** Use `confetti.create(canvas, { useWorker: true })` for a dedicated canvas element with Web Worker rendering. Alternatively, keep particle counts reasonable (50 for tasks, 150 max for milestones) which performs fine without a worker.
**Warning signs:** Noticeable lag when completing goals, especially on mobile.

### Pitfall 5: Zustand Persist Version Migration
**What goes wrong:** Adding new persisted state (e.g., animation preferences) breaks existing users' localStorage.
**Why it happens:** The project already has Zustand persist at version 4 with migration logic. Adding new fields without bumping the version causes undefined state.
**How to avoid:** Bump persist version to 5, add a migration case for version 4 that supplies defaults for any new gamification-related UI state.
**Warning signs:** Console errors about undefined state, broken UI after deploy.

### Pitfall 6: Weekly Score Not Resetting
**What goes wrong:** Weekly score keeps accumulating across weeks instead of resetting on Monday.
**Why it happens:** The weekStartDate in UserStats is never compared against the current week boundary before adding to weeklyScore.
**How to avoid:** On every XP award or dashboard load, check if `weekStartDate` is before the current week's start (Monday). If so, reset weeklyScore to 0 and update weekStartDate to the current week's Monday.
**Warning signs:** Abnormally high weekly scores, scores that never decrease.

## Code Examples

Verified patterns from the existing codebase and official documentation:

### XP Award on Goal Completion (Integration Point)
```typescript
// In goalService.update (lib/services/goal-service.ts), after setting completedAt:
// The API route handler calls gamificationService.awardXp after the update.
// This keeps goal-service.ts focused on CRUD and gamification as a separate concern.

// In app/api/goals/[id]/route.ts PATCH handler:
import { gamificationService } from "@/lib/services/gamification-service";

// After successful goal update:
if (data.status === "COMPLETED") {
  const existing = await goalService.getById(auth.userId, id);
  if (existing && existing.status !== "COMPLETED") {
    const xpResult = await gamificationService.awardXp(
      auth.userId, id, existing.horizon, existing.priority
    );
    // Return xpResult alongside the goal so client can trigger animations
    return NextResponse.json({ ...goal, _xp: xpResult });
  }
}
```

### Level Formula Constants
```typescript
// Add to lib/constants.ts

// Level XP formula: quadratic curve
// Level 1 requires 100 XP, Level 2 requires 400 XP total, Level 5 requires 2500 XP total
// XP for level N = 100 * N^2
// Level from XP = floor(sqrt(totalXp / 100))
export function xpForLevel(level: number): number {
  return 100 * level * level;
}

export function levelFromXp(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100));
}

export function xpToNextLevel(totalXp: number): { current: number; needed: number; percentage: number } {
  const currentLevel = levelFromXp(totalXp);
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const progressXp = totalXp - currentLevelXp;
  const neededXp = nextLevelXp - currentLevelXp;
  return {
    current: progressXp,
    needed: neededXp,
    percentage: neededXp > 0 ? Math.round((progressXp / neededXp) * 100) : 0,
  };
}

// XP thresholds for reference:
// Level 1: 100 XP total (100 to reach)
// Level 2: 400 XP total (300 more from L1)
// Level 3: 900 XP total (500 more from L2)
// Level 5: 2,500 XP total
// Level 10: 10,000 XP total
// Level 20: 40,000 XP total
```

### Animated Progress Bar
```typescript
// components/ui/xp-progress-bar.tsx
"use client";

interface XpProgressBarProps {
  current: number;
  needed: number;
  percentage: number;
  level: number;
}

export function XpProgressBar({ current, needed, percentage, level }: XpProgressBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Level {level}</span>
        <span>{current} / {needed} XP</span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`XP progress: ${current} of ${needed}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

### Recurring Goal Schema Extension
```prisma
// Addition to prisma/schema.prisma

enum RecurringFrequency {
  DAILY
  WEEKLY
  MONTHLY
}

// New fields on Goal model:
model Goal {
  // ... existing fields ...

  // Recurring goal configuration (null for one-off goals)
  isRecurring            Boolean             @default(false)
  recurringFrequency     RecurringFrequency?
  recurringInterval      Int?                @default(1)  // e.g., every 2 weeks
  recurringSourceId      String?             // Points to the template goal if this is a generated instance
  recurringSource        Goal?               @relation("RecurringInstances", fields: [recurringSourceId], references: [id], onDelete: SetNull)
  recurringInstances     Goal[]              @relation("RecurringInstances")

  // Streak tracking (on the template goal)
  currentStreak          Int                 @default(0)
  longestStreak          Int                 @default(0)
  lastCompletedInstance  DateTime?
}
```

### Streak Calculation Logic
```typescript
// In lib/services/recurring-service.ts
import { differenceInCalendarDays, addDays, addWeeks, addMonths, startOfDay } from "date-fns";

function getNextDueDate(lastDate: Date, frequency: string, interval: number): Date {
  switch (frequency) {
    case "DAILY": return addDays(lastDate, interval);
    case "WEEKLY": return addWeeks(lastDate, interval);
    case "MONTHLY": return addMonths(lastDate, interval);
    default: return addDays(lastDate, 1);
  }
}

function isStreakBroken(lastCompleted: Date, frequency: string, interval: number): boolean {
  const nextDue = getNextDueDate(lastCompleted, frequency, interval);
  const today = startOfDay(new Date());
  const dueDay = startOfDay(nextDue);
  // Streak broken if today is past the next due date (with 1 day grace for daily)
  const graceDays = frequency === "DAILY" ? 1 : 0;
  return differenceInCalendarDays(today, dueDay) > graceDays;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RRULE libraries for all recurring patterns | Simple date arithmetic for fixed frequencies | Ongoing | For apps with only 3 frequency types, RRULE adds 15KB+ for no benefit. date-fns covers all cases. |
| Full screen canvas confetti overlay | canvas-confetti with optional Web Worker | canvas-confetti 1.6+ (2023) | Worker offloading prevents main thread jank. disableForReducedMotion added for accessibility. |
| requestAnimationFrame progress bars | CSS transitions with `transition-property: width` | CSS Transitions Level 2 | Zero JS overhead, GPU composited, smooth 60fps. Tailwind makes it one class. |
| Eager instance generation (create all future recurring events) | Lazy generation (create next instance on demand) | Industry standard | Avoids unbounded DB growth. Google Calendar and Habitica both use lazy generation. |

**Deprecated/outdated:**
- react-confetti-canvas (unmaintained since 2021, superseded by react-canvas-confetti)
- Manual `requestAnimationFrame` loops for progress bar animation (CSS transitions handle this natively now)

## Open Questions

1. **Should recurring goal instances inherit the parent's category and priority?**
   - What we know: The template goal has these fields. Generated instances could copy them or let the user customize.
   - What's unclear: User preference for consistency vs. flexibility.
   - Recommendation: Copy category, priority, and parent from the template. User can override on individual instances if needed. This matches the "sensible defaults" UX philosophy from the project decisions.

2. **Should streak break check run server-side on dashboard load or as a separate cron?**
   - What we know: No cron infrastructure exists in the project. Dashboard API is called frequently.
   - What's unclear: Performance impact of checking all recurring goals on every dashboard load.
   - Recommendation: Check on dashboard load since the query is cheap (only recurring goals for one user) and avoids adding cron infrastructure. If performance becomes an issue, add a "last checked" timestamp to skip re-checking within the same hour.

3. **What happens to XP when a goal is un-completed (status changed back from COMPLETED)?**
   - What we know: The current system allows changing status from COMPLETED back to IN_PROGRESS.
   - What's unclear: Whether XP should be revoked.
   - Recommendation: Do NOT revoke XP. Revoking creates negative UX and complex edge cases (what if the user leveled up and then un-completes?). The XpEvent log provides an audit trail. If gaming becomes a concern, it can be addressed in v2.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `prisma/schema.prisma` (UserStats, XpEvent tables already exist), `lib/constants.ts` (XP_PER_HORIZON, PRIORITY_MULTIPLIER already defined), `lib/services/dashboard-service.ts` (already returns XP/level/streak data)
- canvas-confetti GitHub README (https://github.com/catdad/canvas-confetti): Full API documentation, Worker support, disableForReducedMotion
- date-fns documentation (already installed v4.x): `addDays`, `addWeeks`, `addMonths`, `startOfDay`, `differenceInCalendarDays`

### Secondary (MEDIUM confidence)
- XP level formula research (https://blog.jakelee.co.uk/converting-levels-into-xp-vice-versa/): Quadratic `(level/x)^y` formula analysis, tuning recommendations
- Recurring events database design patterns (multiple sources): Template + instance pattern, lazy generation, streak calculation mechanics
- Tailwind CSS progress bar animation patterns (https://tailwindcss.com/docs/animation): `transition-all duration-500 ease-in-out` for smooth width transitions

### Tertiary (LOW confidence)
- None. All critical claims verified against existing codebase or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. canvas-confetti is the clear choice (6M+ weekly downloads, zero deps, 3.5KB). date-fns already installed. No new heavy dependencies.
- Architecture: HIGH. Existing schema already has UserStats + XpEvent tables. Constants already defined. The architecture follows existing project patterns (plain TS service modules, Zustand store, React Query hooks).
- Pitfalls: HIGH. Based on analysis of the actual codebase (double-award on re-completion, Zustand persist versioning, weekly score reset) and common recurring event patterns.

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain, no fast-moving dependencies)
