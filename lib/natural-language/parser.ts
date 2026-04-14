import {
  endOfDay,
  addDays,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  addYears,
} from "date-fns";

export interface ParsedMatch {
  token: string;
  type: "date" | "priority" | "goal" | "category" | "big3" | "recurring";
  value: unknown;
}

export interface ParsedTodo {
  title: string;
  dueDate?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  goalId?: string;
  goalTitle?: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  isBig3?: boolean;
  isRecurring?: boolean;
  recurringFrequency?: "DAILY" | "WEEKLY" | "MONTHLY";
  matches: ParsedMatch[];
}

export interface ParserContext {
  goals: Array<{ id: string; title: string }>;
  categories: Array<{ id: string; name: string; color: string }>;
  now?: Date;
}

function kebabize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const WEEKDAY_NEXT: Record<
  string,
  (d: Date | number) => Date
> = {
  monday: nextMonday,
  tuesday: nextTuesday,
  wednesday: nextWednesday,
  thursday: nextThursday,
  friday: nextFriday,
  saturday: nextSaturday,
  sunday: nextSunday,
  mon: nextMonday,
  tue: nextTuesday,
  wed: nextWednesday,
  thu: nextThursday,
  fri: nextFriday,
  sat: nextSaturday,
  sun: nextSunday,
};

export function parseNaturalLanguage(
  input: string,
  context: ParserContext,
): ParsedTodo {
  let working = input;
  const matches: ParsedMatch[] = [];
  const now = context.now ?? new Date();

  const result: ParsedTodo = {
    title: "",
    matches,
  };

  function strip(pattern: RegExp): RegExpMatchArray | null {
    const m = working.match(pattern);
    if (m) {
      working = working.replace(pattern, " ");
    }
    return m;
  }

  // 1. Big 3 — *big3
  {
    const m = strip(/(^|\s)\*big3\b/i);
    if (m) {
      result.isBig3 = true;
      matches.push({
        token: m[0],
        type: "big3",
        value: true,
      });
    }
  }

  // 2. Recurring — try in order, first match wins
  {
    let recurMatch: RegExpMatchArray | null = null;
    let freq: "DAILY" | "WEEKLY" | "MONTHLY" | null = null;

    recurMatch = strip(/\b(?:every day|daily)\b/i);
    if (recurMatch) {
      freq = "DAILY";
    } else {
      recurMatch = strip(/\b(?:every week|weekly)\b/i);
      if (recurMatch) {
        freq = "WEEKLY";
      } else {
        recurMatch = strip(/\b(?:every month|monthly)\b/i);
        if (recurMatch) {
          freq = "MONTHLY";
        } else {
          recurMatch = strip(/\bevery (mon|tue|wed|thu|fri|sat|sun)\w*\b/i);
          if (recurMatch) {
            freq = "WEEKLY";
          }
        }
      }
    }

    if (recurMatch && freq) {
      result.isRecurring = true;
      result.recurringFrequency = freq;
      matches.push({
        token: recurMatch[0],
        type: "recurring",
        value: freq,
      });
    }
  }

  // 3. Date — try in order, first match wins
  {
    let dateMatch: RegExpMatchArray | null = null;
    let dueDate: Date | null = null;

    dateMatch = strip(/\btoday\b/i);
    if (dateMatch) {
      dueDate = endOfDay(now);
    }

    if (!dueDate) {
      dateMatch = strip(/\btomorrow\b/i);
      if (dateMatch) {
        dueDate = endOfDay(addDays(now, 1));
      }
    }

    if (!dueDate) {
      dateMatch = strip(/\bnext week\b/i);
      if (dateMatch) {
        dueDate = endOfDay(nextMonday(now));
      }
    }

    if (!dueDate) {
      dateMatch = strip(/\bin (\d+) days?\b/i);
      if (dateMatch) {
        const n = parseInt(dateMatch[1], 10);
        if (!Number.isNaN(n)) {
          dueDate = endOfDay(addDays(now, n));
        }
      }
    }

    if (!dueDate) {
      dateMatch = strip(
        /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      );
      if (dateMatch) {
        const fn = WEEKDAY_NEXT[dateMatch[1].toLowerCase()];
        if (fn) {
          dueDate = endOfDay(fn(now));
        }
      }
    }

    if (!dueDate) {
      // Short weekday forms. Guard against matching inside "monthly" by
      // requiring word boundary via \b (already in pattern) — since
      // "monthly" was handled above it's already been stripped.
      dateMatch = strip(/\b(mon|tue|wed|thu|fri|sat|sun)\b/i);
      if (dateMatch) {
        const fn = WEEKDAY_NEXT[dateMatch[1].toLowerCase()];
        if (fn) {
          dueDate = endOfDay(fn(now));
        }
      }
    }

    if (!dueDate) {
      // D.M.YYYY or D.M. (European format). Default to current year when
      // the year is omitted; if that produces a past date, roll forward
      // one year.
      dateMatch = strip(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?\b/);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        const yearPart = dateMatch[3];
        const year = yearPart ? parseInt(yearPart, 10) : now.getFullYear();
        if (
          !Number.isNaN(day) &&
          !Number.isNaN(month) &&
          !Number.isNaN(year) &&
          day >= 1 &&
          day <= 31 &&
          month >= 1 &&
          month <= 12
        ) {
          let candidate = new Date(year, month - 1, day, 23, 59, 59, 999);
          if (!yearPart && candidate.getTime() < now.getTime()) {
            candidate = addYears(candidate, 1);
          }
          dueDate = candidate;
        }
      }
    }

    if (dateMatch && dueDate) {
      const iso = dueDate.toISOString();
      result.dueDate = iso;
      matches.push({
        token: dateMatch[0],
        type: "date",
        value: iso,
      });
    }
  }

  // 4. Priority — check high, medium, low in that order. Match !!! before
  // !! to avoid double-capture. `!` alone is deliberately unsupported
  // because it's ambiguous. The word-form patterns use (^|\s) instead of
  // \b at the start so the optional `!` is actually consumed: \b does
  // not match between a space and `!` (both non-word), leaving the `!`
  // stranded in the title.
  {
    let priMatch: RegExpMatchArray | null = null;
    let pri: "LOW" | "MEDIUM" | "HIGH" | null = null;

    priMatch = strip(/!!!/);
    if (priMatch) {
      pri = "HIGH";
    } else {
      priMatch = strip(/(^|\s)!?high\b/i);
      if (priMatch) {
        pri = "HIGH";
      } else {
        priMatch = strip(/\burgent\b/i);
        if (priMatch) {
          pri = "HIGH";
        }
      }
    }

    if (!pri) {
      priMatch = strip(/!!/);
      if (priMatch) {
        pri = "MEDIUM";
      } else {
        priMatch = strip(/(^|\s)!?medium\b/i);
        if (priMatch) {
          pri = "MEDIUM";
        }
      }
    }

    if (!pri) {
      priMatch = strip(/(^|\s)!?low\b/i);
      if (priMatch) {
        pri = "LOW";
      }
    }

    if (priMatch && pri) {
      result.priority = pri;
      matches.push({
        token: priMatch[0],
        type: "priority",
        value: pri,
      });
    }
  }

  // 5. Goal link — #token, first match wins. Match against kebab-cased
  // goal titles; the kebab form of the title must START with the token.
  {
    const goalRegex = /#([a-z0-9][a-z0-9_-]*)/i;
    const m = working.match(goalRegex);
    if (m) {
      const token = kebabize(m[1]);
      const goal = context.goals.find((g) =>
        kebabize(g.title).startsWith(token),
      );
      if (goal) {
        result.goalId = goal.id;
        result.goalTitle = goal.title;
        matches.push({
          token: m[0],
          type: "goal",
          value: goal.id,
        });
        working = working.replace(m[0], " ");
      }
    }
  }

  // 6. Category link — @token, first match wins, against category names.
  {
    const catRegex = /@([a-z0-9][a-z0-9_-]*)/i;
    const m = working.match(catRegex);
    if (m) {
      const token = kebabize(m[1]);
      const cat = context.categories.find((c) =>
        kebabize(c.name).startsWith(token),
      );
      if (cat) {
        result.categoryId = cat.id;
        result.categoryName = cat.name;
        result.categoryColor = cat.color;
        matches.push({
          token: m[0],
          type: "category",
          value: cat.id,
        });
        working = working.replace(m[0], " ");
      }
    }
  }

  result.title = working.replace(/\s+/g, " ").trim();

  return result;
}
