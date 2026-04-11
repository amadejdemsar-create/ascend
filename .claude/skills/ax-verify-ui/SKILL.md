---
name: ax:verify-ui
description: Manually verify UI changes in the running Ascend app via Playwright. Wraps the ascend-ui-verifier agent so Amadej can run a verification on demand without editing code. Useful as a "did my last session actually work" check before committing or pushing frontend changes.
user_invocable: true
---

# ax:verify-ui

Trigger a UI verification of recent changes (or a specific page) using the `ascend-ui-verifier` agent. The agent drives Playwright, clicks through the app like a real user, captures screenshots, checks console errors, and writes a structured report to `.ascendflow/verification/`.

## Execution Quality Bar (read first)

This skill enforces the Ascend quality bar from `/Users/Shared/Domain/Code/Personal/ascend/CLAUDE.md` and the global rule in `~/.claude/CLAUDE.md`.

**Forbidden phrases when the verifier returns anything other than PASS:**

- "Ready to ship" / "Ready to commit" / "Ready to push" / "Ready to deploy" / "Looks good"
- Never downgrade a FAIL to a PASS or to "mostly works"
- Never drop scenarios from the verifier's report when relaying it to the user

If the verifier returns ABORTED (dev server not running, tsc broken, DB unreachable), relay that clearly and ask how to proceed.

**Reference agent:** The actual clicking, screenshots, and report writing are performed by the `ascend-ui-verifier` agent at `.claude/agents/ascend-ui-verifier.md`. Read it for the exact phases and scenario format.

## Usage

- `ax:verify-ui` — verify the most recently changed UI pages (auto-detected from `git diff`)
- `ax:verify-ui <path>` — verify a specific page or component (e.g. `ax:verify-ui components/goals/goal-filter-bar.tsx`)
- `ax:verify-ui goals` — natural language, resolve to the closest page (here `/goals`)
- `ax:verify-ui HEAD~3..HEAD` — verify the diff of the last three commits

## When to Use

- After finishing a UI change, before committing.
- After pulling new code and wanting to confirm nothing regressed in the local environment.
- When something "feels off" but `npx tsc --noEmit` and `npm run test` are green.
- As the final gate in `ax:plan` task lists that include frontend work.
- Before pushing to `main` (the Dokploy deploy rebuilds on push; catching a UI bug locally saves a deploy cycle).

## When NOT to use

- For backend-only changes (use `ax:review` + `ax:test` instead)
- For design / visual polish audits (use the `ascend-ux` agent directly)
- For unit or integration tests (use `ax:test`)
- When the dev server is not running (the verifier will abort; start it first with `PORT=3100 npm run dev` or whichever port you prefer)

## Workflow

### Step 1: Determine what to verify

If the user passed a path, a commit range, or a natural-language description, use it directly.

Otherwise, auto-detect:

```bash
cd /Users/Shared/Domain/Code/Personal/ascend && git diff --name-only HEAD
cd /Users/Shared/Domain/Code/Personal/ascend && git diff --cached --name-only
```

Filter for files that are UI-adjacent:

- `components/**/*.tsx`
- `app/(app)/**/*.tsx`
- `lib/hooks/**/*.ts`
- `lib/stores/**/*.ts`
- `lib/validations.ts`
- `lib/api-client.ts`
- `lib/queries/keys.ts`

Map the changed files to pages:

- `components/goals/**` → `/goals`
- `components/todos/**` → `/todos`
- `components/calendar/**` → `/calendar`
- `components/dashboard/**` → `/dashboard`
- `components/context/**` → `/context`
- `components/categories/**` → sidebar, `/settings`, and any of the three primary pages (goals/todos/context) that render the category tree
- `components/layout/**` → every authenticated page (sidebar nav is global)
- `lib/hooks/use-goals.ts` → `/goals` + `/dashboard`
- `lib/hooks/use-todos.ts` → `/todos` + `/calendar` + `/dashboard`
- `lib/validations.ts` → every form in the app (goals modal, todos quick-add, category form, context editor)
- `lib/stores/ui-store.ts` → every filter bar + view switcher + selected-item state

Pick the 1 to 3 most relevant pages as the primary verification target and list the others as regression-sweep candidates.

If no UI-adjacent files changed, tell the user there is nothing UI-facing to verify and exit.

### Step 2: Confirm the dev server is running

```bash
for PORT in 3000 3001 3100; do
  if curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
    echo "FOUND:$PORT"
    break
  fi
done
```

If no port responds, tell the user:

> The Ascend dev server is not running. Start it with `PORT=3100 npm run dev` (or your preferred port), wait for "Ready", then re-run `ax:verify-ui`.

Do NOT start the dev server yourself. Amadej may want to pick the port, the database URL, or the log level.

### Step 3: Launch the `ascend-ui-verifier` agent

Use the Task tool with `subagent_type: "ascend-ui-verifier"`. Pass it:

- The list of changed files (or the user's explicit target)
- A plain-language description of what changed, synthesized from the diff or the user input
- The detected dev server port
- The primary page(s) to verify and the regression sweep candidates
- Any specific concerns the user mentioned ("I'm worried the filter bar stopped persisting")

The agent will run Phase 0 (read the diff) → Phase 0.5 (write a scenario plan) → Phase 1 (environment check) → Phase 2 (open the app) → Phase 3 (navigate via clicks) → Phase 4 (execute every scenario) → Phase 5 (regression sweep) → Phase 6 (write the report file) → Phase 7 (return a structured summary). The whole run is usually 2 to 5 minutes depending on scenario count.

### Step 4: Relay the result

Present the verifier's report summary to the user:

```
Ascend UI verification complete.

Verdict: {PASS | PASS WITH NOTES | FAIL | NEEDS ATTENTION | ABORTED}
Scenarios: {X passed, Y failed of N total}
Dev port: {port}
Report: .ascendflow/verification/{filename}.md

Top issues:
1. {file:line} — {plain-language description}
2. ...

Recommendation: {ship | fix first | investigate}
```

Then, if the verdict is FAIL or NEEDS ATTENTION, offer to launch `ascend-dev` with the specific issues as follow-up.

### Step 5: Iteration loop

If the verifier returns FAIL:

1. Print the failing scenarios with `file:line` and exact fix where possible.
2. Ask the user: "Want me to fix these now and re-verify, or will you fix them yourself?"
3. If yes, launch `ascend-dev` with the list of issues. After the fix lands, re-run `ax:verify-ui` end to end (the git diff may have changed; auto-detection runs again).
4. Repeat until the verifier returns PASS or PASS WITH NOTES.
5. Never downgrade a FAIL verdict to close the loop. If you cannot fix a blocker, surface it and stop.

## Rules

- **Never auto-fix.** The verifier is read-only. Users decide what changes to make.
- **Never downgrade a FAIL.** If the verifier says FAIL, report FAIL. Do not soften the message.
- **Never report PASS when scenarios are missing.** If the verifier aborted mid-run, that's NEEDS ATTENTION, not PASS.
- **Always save the report file** so it can be referenced later and snapshotted by `ax:save`.
- **Always pass the detected port** to the agent so it doesn't have to re-detect it. Don't guess the port; always curl `/api/health`.

## Edge cases

- **Clean working tree + no target given:** Tell the user "no UI changes detected; pass a path or page name to verify something specific" and exit. Do not launch the agent speculatively.
- **Dev server on an unexpected port:** If the user's dev server is on a port other than 3000/3001/3100, ask them for the port and pass it to the agent.
- **Huge diff across many UI files:** Warn the user the verification may take 5+ minutes. Offer to scope to the top 2 to 3 pages.
- **Dev server starts but a specific page returns 500:** The verifier will report this as a fresh console error and FAIL the scenario. That's the correct behavior; surface it directly.
- **Playwright MCP not available:** The agent requires `mcp__playwright__*` tools. If they're missing, check `~/.claude.json` has `playwright` under `mcpServers` and Claude Code has been restarted since. Tell the user to fix the config and retry.
