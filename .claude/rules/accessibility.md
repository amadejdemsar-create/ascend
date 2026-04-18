# Accessibility

WCAG 2.1 AA is the enforcement target for all Ascend UI. Every frontend change that adds or modifies interactive elements, form inputs, color usage, focus behavior, or animation must pass the checks below before calling `ax:wave-close` or declaring the change done.

This rule was created after the DS8 accessibility pass (commit `5329bcf`, 35+ fixes across 21 files) to prevent regressions and enforce the baseline going forward.

## Interactive Elements

Every interactive element (buttons, links, toggles, menu items, tabs, sliders) must have an accessible name. Acceptable sources, in priority order:

1. Visible text content inside the element.
2. `aria-label` when the element has no visible text (icon-only buttons).
3. `aria-labelledby` pointing to a visible label elsewhere in the DOM.

If an element has none of these, it is invisible to screen readers. Flag it.

## Form Inputs

Every `<input>`, `<textarea>`, `<select>`, and custom form control must have an associated label. Acceptable patterns:

- A `<label>` element with a matching `htmlFor` attribute.
- `aria-label` directly on the input.
- `aria-labelledby` pointing to visible text.
- Wrapping the input inside a `<label>` element.

Placeholder text alone is NOT a label. It disappears on focus and is not announced reliably by all screen readers.

## Color Contrast

Follow the DS3 palette contrast requirements:

- Body text against background: minimum 4.5:1 contrast ratio (WCAG AA normal text).
- UI text (labels, badges, secondary text): minimum 3:1 contrast ratio (WCAG AA large text / UI components).
- Interactive element boundaries against their background: minimum 3:1 contrast ratio.
- Never rely on color alone to convey information. Pair color with icons, text, or patterns (e.g., status indicators use both color and icon/text).

The `ascend-ux` agent audits contrast during visual design reviews.

## Focus Management

Every interactive element must have a visible focus indicator when navigated via keyboard (Tab / Shift+Tab). Tailwind's `focus-visible:` utilities are the standard pattern.

Specific requirements:

- Focus ring must be visible in both light and dark themes.
- Focus order must follow visual layout (left to right, top to bottom within a panel).
- No focus traps in normal page flow. The user must be able to Tab through the entire page and reach every interactive element.
- Skip-to-content link is recommended for the two-panel layout (sidebar + main content).

## Modals and Dialogs

All modal dialogs (shadcn `Dialog`, `AlertDialog`, `Sheet`) must:

- Set `aria-modal="true"` (shadcn does this by default; verify custom modals).
- Trap focus inside the modal while open. Tab cycling stays within the modal.
- Restore focus to the trigger element when closed.
- Be closable via Escape key.
- Have an accessible title via `aria-labelledby` or `aria-label`.

## Toasts and Live Regions

Toast notifications (via `sonner`) must be announced by screen readers. Sonner uses `aria-live="polite"` by default. Verify that:

- Success toasts use `role="status"` (polite).
- Error toasts use `role="alert"` (assertive) so they are announced immediately.
- Toasts are not the only feedback mechanism for critical actions; pair with visual state changes.

## Icons

Icons used alone (no adjacent text) must have one of:

- `aria-label` on the icon or its parent button.
- `aria-hidden="true"` on the icon AND a visually hidden `<span className="sr-only">` with descriptive text.

Decorative icons (next to text that already conveys the same meaning) should have `aria-hidden="true"` to avoid redundant announcements.

## Keyboard Shortcuts

All keyboard shortcuts in Ascend (Cmd+K for command palette, Shift+Tab for plan mode, etc.) must:

- Not conflict with screen reader shortcuts (Ctrl+Option on macOS VoiceOver).
- Be documented in the command palette and discoverable via the `?` shortcut if one exists.
- Use `event.key` for detection, not `event.keyCode` (deprecated).

## Lists and Groups

- Ordered and unordered collections of items must use semantic `<ul>`, `<ol>`, or `<dl>` elements. Divs with items that look like a list but lack list semantics fail this check.
- Groups of related controls (filter bar dropdowns, button groups) should use `role="group"` with an `aria-label` describing the group.

## Images and Media

- All informational images must have descriptive `alt` text.
- Decorative images must have `alt=""` (empty alt) so screen readers skip them.
- Future: when voice memo recordings are added (Wave 6), audio must have text transcripts or captions.

## Motion and Animation

- All non-essential animation (confetti, hover transitions, loading spinners beyond a threshold) must respect `prefers-reduced-motion`. Use the `motion-safe:` and `motion-reduce:` Tailwind variants.
- Essential animations (progress indicators, loading states) may continue but should be simplified under reduced motion.
- The DS9 motion documentation defines which animations are essential vs decorative.

## Touch Targets

On mobile viewports (bottom tab bar, drawer, calendar cells):

- All interactive touch targets must be at least 44x44px (WCAG 2.5.5 AAA, adopted as our AA+ baseline).
- Spacing between adjacent targets must prevent accidental activation.

## How to Verify

- **Automated (during development):** `ax:verify-ui` scenarios should spot-check via Playwright's `aria-*` selectors. Include checks for `getByRole`, `getByLabelText`, and `getByText` to verify accessible names exist.
- **Agent audits:** `ascend-ux` checks color contrast and focus states during visual design reviews. `ascend-ui-verifier` checks behavioral accessibility (focus traps, keyboard navigation, aria attributes) during Playwright verification.
- **Manual (per major surface):** Run a VoiceOver smoke test on macOS: navigate every interactive element on the page using Tab + VoiceOver cursor. Verify announcements are coherent. Do this at minimum once per wave for each surface that changed.

## Enforcement

Every frontend change that adds or modifies UI must pass this rule before calling `ax:wave-close`. The `ascend-ux` agent, the `ascend-ui-verifier` agent, and the `ax:verify-ui` skill all enforce subsets of these checks during their respective workflows.
