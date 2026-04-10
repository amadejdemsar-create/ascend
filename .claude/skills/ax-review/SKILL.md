---
name: ax:review
description: Review the current changes in the Ascend working tree against the safety rules and patterns defined in CLAUDE.md. Runs git diff, launches the ascend-reviewer agent, checks userId scoping, Zod validation, service layer usage, cache invalidation, and TypeScript/build health. Returns a structured verdict with exact fixes.
user_invocable: true
---

# ax:review

Audits the uncommitted (or specified) changes in the Ascend repo against the six safety rules, the four pattern files, and the documented danger zones. Returns a structured PASS / PASS WITH NOTES / FAIL verdict.

## Execution Quality Bar (read first)

This skill enforces the Ascend quality bar from `/Users/Shared/Domain/Code/Personal/goals/CLAUDE.md` and the global rule in `~/.claude/CLAUDE.md`.

**Mandatory verifications before any PASS verdict:**

- `npx tsc --noEmit` passes with zero errors
- `npm run build` passes with zero errors (required when routes or App Router files changed)
- No console errors in the browser for touched pages (verify for UI work via Chrome DevTools MCP in Dia)
- Every safety rule in CLAUDE.md is respected in the diff

**Forbidden phrases when any issue exists:**

If ANY check returns FAIL, or the reviewer finds ANY `[FAIL]` issue, you may NOT use the words:
- "Approved" / "Ready to ship" / "Ready to commit" / "Ready to deploy" / "Looks good to merge"
- "PASS" as the verdict (must be `PASS WITH NOTES` or `FAIL`)

You MUST instead say:
- "FAIL verdict. <N> blocking issues. Fix and re-run `ax:review`."
- "PASS WITH NOTES. <N> non-blocking recommendations. Safe to commit, but consider: [list]."

**Reference agent:** The actual safety rule checks, pattern checks, and danger zone checks are performed by the `ascend-reviewer` agent at `/Users/Shared/Domain/Code/Personal/goals/.claude/agents/ascend-reviewer.md`. Read it for the exact rules being enforced.

## When to Use

- After finishing a feature, before committing.
- After a coding session to verify no safety rules were broken.
- When preparing a PR.
- When another agent asks for a second opinion.
- As the final phase of `ax:plan` task lists.

## Workflow

### Step 1: Gather the change context

Run these commands in parallel via Bash:

```bash
cd /Users/Shared/Domain/Code/Personal/goals && git status
cd /Users/Shared/Domain/Code/Personal/goals && git diff
cd /Users/Shared/Domain/Code/Personal/goals && git diff --staged
```

If `git status` shows no changes, tell the user there is nothing to review and exit.

If the user passed a specific file or commit range as arguments, scope the diff accordingly:
- `ax:review components/goals/goal-detail.tsx` -> only diff that file
- `ax:review HEAD~3..HEAD` -> diff the last three commits

### Step 2: Launch the ascend-reviewer agent

Use the Task tool with `subagent_type: "ascend-reviewer"` and pass it:
- The list of changed files
- The diff content
- Any specific concerns from the user ("I'm worried about cache invalidation")

The agent will:
1. Read each changed file end to end.
2. Run the six safety rule checks (userId, Zod, service layer, cache invalidation, build, no forbidden Prisma commands).
3. Check for danger zone touches (todo transactionality, context search_vector, two recurring systems, visit-triggered recurrence, fetchJson duplication, board view dead code, missing error boundaries).
4. Check pattern compliance from `.claude/rules/` (service patterns, API route patterns, component patterns, MCP tool patterns).
5. Run `npx tsc --noEmit` and, if routes changed, `npm run build`.
6. Return a structured verdict.

### Step 3: Save the review output

Write the verdict to disk:

```
/Users/Shared/Domain/Code/Personal/goals/.ascendflow/reviews/<YYYY-MM-DD-HHMM>-review.md
```

Use ISO-8601 for the filename but European date format (D. M. YYYY) in the body.

The review file should have this shape:

```markdown
# Ascend Review: <YYYY-MM-DD HH:MM>

**Files reviewed**: <list>
**TypeScript**: pass | fail
**Build**: pass | fail | skipped
**Verdict**: PASS | PASS WITH NOTES | FAIL

## Issues

1. [FAIL | NOTE] path/to/file.ts:123
   - Rule: <which rule>
   - Problem: <description>
   - Fix: <exact code change>

## Danger zones touched

- <if any>

## Recommendations

- <non-blocking>

## Summary

<one paragraph>
```

### Step 4: Iteration loop (mandatory)

Review is not a one-shot. If the reviewer returns FAIL:

1. Print the issues with file, line, rule, and exact fix.
2. Ask the user: "Want me to fix these now and re-review, or will you fix them yourself?"
3. If the user says yes, launch `ascend-dev` with the specific issues, then re-run this skill end to end (git diff may have changed).
4. Repeat until the reviewer returns PASS or PASS WITH NOTES.
5. Never downgrade a FAIL to a PASS to close the loop. If you cannot fix it, surface the blocker and stop.

### Step 5: Print the verdict

Print a condensed summary to the user, then the full verdict file path. Example:

```
Ascend Review complete.

Verdict: PASS WITH NOTES
TypeScript: pass
Build: pass

Issues:
1. [NOTE] lib/hooks/use-todos.ts:45 - Mutation only invalidates todos cache. Should also invalidate goals and dashboard.
2. [NOTE] components/todos/todo-detail.tsx:200 - New field is not click-to-edit.

Full review: .ascendflow/reviews/2026-04-08-1430-review.md
```

If verdict is FAIL, tell the user clearly to fix the issues before committing.

## Rules

- **Never auto-fix.** The reviewer is read-only. Users decide what to change.
- **Never downgrade a FAIL.** If the reviewer says FAIL, report FAIL. Do not soften.
- **Always run the build** when routes changed. `npx tsc --noEmit` alone misses App Router route-level errors.
- **Always save the review file** so the user can reference it later, and so `ax:save` can snapshot it.

## Edge Cases

- **Clean working tree**: Tell the user "nothing to review" and exit. Do not launch the agent.
- **Huge diff (>2000 lines)**: Warn the user the review may take longer. Offer to scope by file.
- **Build fails for unrelated reasons**: Report the build failure and ask whether to continue the review of the changed files.
- **Reviewer disagrees with user's intent**: If the user overrides a review finding, save their reasoning to the review file as an addendum.
