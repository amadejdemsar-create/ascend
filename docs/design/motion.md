# Ascend Motion Budget

Rules for how movement works in Ascend. The app has a distinctive motion language (hover-lift, view-transitions, animated counters, confetti, progress bars) — individually tasteful, collectively busy if unbudgeted.

Last updated: 15. 4. 2026

---

## Budget rule

**Max 2 noticeable animations visible in any 1-second window.**

"Noticeable" means something the eye tracks (movement, fade, scale, color change > 100ms). Continuous loops (spinners, pulsing dots) count as one animation regardless of duration.

If a user action would trigger 3+ animations (e.g., completing a todo: XP counter ticks, progress bar fills, confetti fires, goal progress recalcs, streak updates), prioritize:

1. Keep the most informative animation (the XP counter tick — quantitative feedback).
2. Debounce / throttle the others.
3. Drop the least meaningful (confetti should be a once-per-session reward, not per-interaction).

---

## Categories

### Celebration (once per session, never per interaction)
- Confetti on goal completion
- Level-up animation
- Streak milestone (7-day, 30-day, 100-day)

Rule: fire at most once per 2 seconds. Track via a module-level timestamp or a Zustand ephemeral flag.

### Feedback (per action, subtle)
- Hover-lift on cards (`.hover-lift`)
- Button scale on press
- Toast slide-in
- Checkbox fill on completion

Rule: always `< 200ms`, `ease-out`. Use CSS `transition-*` not JS animation.

### State transitions (per view change)
- View transitions between pages (built on Next.js + CSS view-transitions)
- Detail panel slide in/out
- Modal open/close

Rule: `250-350ms`, use the platform's native `ViewTransition` where possible.

### Continuous feedback (long-running)
- Animated counters (`useAnimatedCounter`)
- Progress bar fills (`.progress-bar-animated`)
- Focus timer countdown

Rule: no more than one at a time in a given card/widget. Animated counters must skip when `from === to` (L5 fix).

---

## `prefers-reduced-motion` enforcement

The OS `prefers-reduced-motion: reduce` setting means: replace motion with instant state changes.

### CSS level (handled in `app/globals.css`)

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }

  .hover-lift, .hover-glow, .progress-bar-animated {
    transition: none !important;
  }

  .hover-lift:hover, .hover-glow:hover {
    transform: none !important;
    box-shadow: none !important;
  }
}
```

### JS level (per hook / component)

- **`useAnimatedCounter`:** checks `window.matchMedia("(prefers-reduced-motion: reduce)").matches`. If true, sets the final value immediately and skips the tween.
- **Confetti:** checked in the completion handler. If reduced motion is preferred, skip the `confetti()` call entirely.
- **Focus timer:** countdown text updates are not "animation" in the motion sense; they're informative state changes. Leave as-is.

### Helper

`lib/hooks/use-prefers-reduced-motion.ts` exposes the user preference as a boolean. Use it in any component that fires JS-driven animations.

```ts
const reducedMotion = usePrefersReducedMotion();
if (reducedMotion) { /* skip confetti / instant state change */ }
```

---

## Forbidden patterns

### F1. `setInterval` animation loops

Use `requestAnimationFrame` or CSS. `setInterval` throttles when the tab backgrounds and produces inconsistent frame rates.

### F2. Chained toasts on a single action

If completing a todo fires: "Todo completed" → "+30 XP" → "Progress updated", reduce to one toast: "Todo completed · +30 XP".

### F3. Looping animations on non-loading elements

`animate-pulse` and `animate-spin` are for loading states only. Don't use them as decoration (pulsing dots that aren't status indicators, spinning icons on idle buttons).

---

## How to add a new animation

1. Check which category it fits (celebration / feedback / state / continuous).
2. Check the budget: does any surface that mounts this component already have its 2-animation quota filled? If yes, replace rather than add.
3. Add the `prefers-reduced-motion` guard. CSS class → `@media` rule; JS → `usePrefersReducedMotion()` check.
4. Write it. Test with OS reduced-motion ON and OFF.
5. Add to this doc's category list so the next contributor sees precedent.
