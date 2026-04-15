# Ascend Color Semantics

This document defines what colors MEAN in the Ascend UI. It exists because we had a recurring problem of leaf components bypassing the design tokens (hardcoded hex, broken `hsl(var(...))`, inconsistent semantic choices). Every non-neutral color used in the app should map to one of the semantics below.

Last updated: 15. 4. 2026

---

## Source of truth

The oklch tokens are defined in `app/globals.css` inside the `:root` block (light) and `.dark` block (dark). Tailwind v4's `@theme inline` block exposes them as `--color-*` so they can be used in class names and inline styles.

```css
/* Example token surface */
--primary: oklch(...);            /* the "brand" accent */
--color-primary: var(--primary);  /* what Tailwind sees */
```

---

## Semantic palette

### Primary (indigo)

- **Token:** `--color-primary`
- **Meaning:** "Ascend" brand accent. Used sparingly for interactive primary elements (CTAs, selected states, active navigation).
- **Where it appears:** sidebar selected nav item, goal detail section accents, category breadcrumbs, primary buttons, chart-1 (todo-completion, goal-progress when not using chart-6).
- **Where it SHOULD NOT appear:** destructive actions, success states, warning states.

### Destructive (red)

- **Token:** `--color-destructive`
- **Meaning:** Danger. Used for irreversible or high-consequence actions.
- **Where it appears:** Delete buttons, "Danger Zone" labels, calendar deadline dots, priority HIGH badge (`bg-destructive/10 text-destructive`).
- **Where it SHOULD NOT appear:** merely "important" or "loud" — use amber for that. Destructive is reserved for consequence.

### Amber (warning / priority / Big 3)

- **Source:** Tailwind's `amber-400` / `amber-500` / `amber-600` (no oklch token yet; this is a gap).
- **Meaning:** Attention without alarm. Used for Big 3 (daily priority), priority MEDIUM badge, overdue indicators (less urgent than destructive), and warning states.
- **Where it appears:** Big 3 star icon (`text-amber-400 fill-amber-400`), priority MEDIUM badge, calendar Big 3 dot, contrast warning in category color picker.
- **Where it SHOULD NOT appear:** primary actions, success confirmation.

### Green (success / completed)

- **Source:** Tailwind's `green-500` + `--chart-6` (oklch, for chart stroke/fill).
- **Meaning:** Completion, success, positive delta.
- **Where it appears:** completed todo check icon, calendar "all done" day dot, analytics summary delta up-arrows, goal tree completed progress bar, chart-6 on goal-progress line chart.
- **Where it SHOULD NOT appear:** merely "neutral" — use muted for that.

### Violet (chart accent)

- **Token:** `--color-chart-2`
- **Meaning:** Secondary chart accent. Used only in analytics to distinguish XP curve from the primary indigo.
- **Where it appears:** XP earned area chart.

### Muted (neutral / low signal)

- **Tokens:** `--color-muted`, `--color-muted-foreground`
- **Meaning:** Secondary content, deemphasized elements, placeholders.
- **Where it appears:** Subtitles, metadata, empty-state icons (`text-muted-foreground/30`), priority LOW badge, calendar pending-todo dot, muted borders.

### Background / Foreground

- **Tokens:** `--color-background`, `--color-foreground`
- **Meaning:** Neutral surface + primary text.
- **Where it appears:** Page canvas, primary text.

---

## Semantic usage matrix

| Semantic | Token(s) | Canonical examples |
|----------|----------|--------------------|
| Brand | `--color-primary` | Primary CTA, active nav, chart-1 |
| Danger | `--color-destructive` | Delete buttons, HIGH priority, deadline dots |
| Warning / Priority MEDIUM | `amber-*` | Big 3 star, MEDIUM badge, overdue |
| Success | `green-500`, `--color-chart-6` | Completed check, all-done dot, goal-progress chart |
| Chart accent 2 | `--color-chart-2` | XP earned chart |
| Neutral / Low | `--color-muted*` | LOW priority, pending dots, placeholders |

---

## Rules

### R1. Never use raw hex or `rgb()` in components

Only two exceptions:
1. User-configurable colors stored as hex strings in the database (e.g., `Category.color`)
2. SVG `fill` attributes driven by user data

Everywhere else, use Tailwind classes or `var(--color-*)`.

### R2. Never use `hsl(var(--X))` for any Ascend token

The oklch tokens are NOT HSL triplets. `hsl(var(--primary))` produces invalid CSS. Always use `var(--color-primary)` or the Tailwind class `text-primary` / `bg-primary`.

### R3. Priority is communicated by color AND text, not color alone

WCAG accessibility: color-only indicators fail for colorblind users. Every priority badge has a visible label ("High" / "Medium" / "Low"). Same for calendar dots (the legend below the grid names each dot).

### R4. Green is "done", not "go"

Ascend doesn't use green for "next step" or "primary action" — those use `--color-primary`. Green is strictly for completed/success states.

### R5. Amber is "notice this", not "urgent"

If something is urgent enough that a user needs to be jolted, use destructive. Amber is for "consider this" (Big 3 picking, medium priority, contrast warnings).

---

## Known gaps

1. **No oklch amber token.** We use `amber-400`/`amber-500` Tailwind classes. Consider adding `--warning: oklch(0.82 0.14 85)` as a proper semantic token in a future iteration.
2. **No success token separate from chart-6.** The green semantic relies on `green-500` in most places but chart-6 in analytics. Unify as `--success` in a future iteration.
3. **Chart-1 is overloaded.** Todo-completion bar chart, goal-progress-chart (before chart-6), and primary brand all share `--color-primary`. Fine for now, but if more chart types are added, expand the chart palette.

---

## When in doubt

If you're writing a component and unsure which color to use:

1. Is it interactive and primary? → `primary`
2. Is it destructive? → `destructive`
3. Is it a warning or priority? → `amber-500`-family
4. Is it success / completed? → `green-500` or `chart-6`
5. Is it secondary or muted? → `muted-foreground`
6. Otherwise → `foreground`

If none of the above fit, you're introducing a new semantic. Discuss with the user or default to muted before adding a new token.
