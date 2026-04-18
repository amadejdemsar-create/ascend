---
name: ax:wave-close
description: Strict completion ritual for closing a Context v2 wave. Re-reads the PRD success criteria, audits every deliverable as DONE/SKIPPED/NOT DONE, runs ax:test + ax:review + ax:verify-ui + ax:critique, and writes a CLOSE-OUT.md. Blocks the word "complete" if any item is skipped or not done. Use this at the end of every wave.
user_invocable: true
---

# ax:wave-close

The strict completion ritual that closes a Context v2 wave. This is the most rigorous quality gate in the Ascend workflow. It verifies every deliverable from the wave's PRD, runs the full verification suite, and produces a permanent CLOSE-OUT.md record.

## Execution Quality Bar (read first)

This skill enforces the Ascend quality bar from `/Users/Shared/Domain/Code/Personal/ascend/CLAUDE.md` and the global rule in `~/.claude/CLAUDE.md`.

**The global Execution Quality Bar's "Mandatory completion checklist" applies in full.** Before declaring any wave "complete," you MUST re-list every deliverable from the original PRD and mark each as DONE / SKIPPED (with reason) / NOT DONE (with reason). If ANY are SKIPPED or NOT DONE, you may not use the word "complete." Use "partially complete" and explain exactly what remains.

**Quality bar question before signing off:** Would a world-class engineering team ship this as is? If the answer is "no, there are gaps," say so. Do not ship gaps silently.

## When to Use

- At the end of every Context v2 wave, before starting the next
- When the user says "close wave N" or "are we done with wave N?"
- When all tasks in a wave's TASKS.md appear to be checked off

## When NOT to use

- Mid-wave (that is `ax:save` territory)
- For non-wave features (use `ax:review` + `ax:test` directly)
- If the wave has not started yet (run `ax:wave-start` first)

## Usage

- `ax:wave-close <N>` — close Wave N (e.g., `ax:wave-close 1`)
- `ax:wave-close` — will detect the current open wave and close it

## Workflow

### Step 1: Identify the wave and read planning documents

```bash
# Find the wave directory
WAVE_DIR=$(ls -d /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/context-v2/wave-${N}-*/ 2>/dev/null | head -1)

if [ -z "$WAVE_DIR" ]; then
  echo "NO WAVE DIRECTORY for Wave ${N}"
fi

# Check CLOSE-OUT.md does not already exist
if [ -f "${WAVE_DIR}CLOSE-OUT.md" ]; then
  echo "ALREADY CLOSED"
fi
```

If no wave directory exists, stop: "Wave N directory does not exist. Cannot close a wave that was never started."

If CLOSE-OUT.md already exists, stop: "Wave N is already closed. Read the existing CLOSE-OUT.md or re-open it by deleting the file."

Read the planning documents end to end:

```bash
cat "${WAVE_DIR}PRD.md"
cat "${WAVE_DIR}TASKS.md"
```

### Step 2: Extract success criteria from PRD

Read the PRD's "Success Criteria" section. Also read the wave's success criteria from VISION.md section 6:

```bash
grep -A 20 "^\*\*Wave ${N}:\*\*" /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/context-v2/VISION.md
```

Create a master checklist combining both sources. Every criterion gets a DONE / SKIPPED / NOT DONE verdict.

### Step 3: Audit each deliverable against the codebase

For each item in TASKS.md, verify it is actually done by reading the relevant files:

**For schema changes:** Check `prisma/schema.prisma` for the expected fields, models, and relations.

**For service methods:** Check `lib/services/<domain>-service.ts` for the expected methods. Read the method body to verify it is implemented (not a stub).

**For API routes:** Check `app/api/<path>/route.ts` exists and has the expected handlers (GET, POST, PUT, DELETE). Verify auth, Zod parsing, service call, and response.

**For hooks:** Check `lib/hooks/use-<domain>.ts` for the expected queries and mutations. Verify cache invalidation.

**For components:** Check `components/<domain>/<name>.tsx` exists. Verify it follows the patterns from `.claude/rules/component-patterns.md`.

**For MCP tools:** Check `lib/mcp/schemas.ts` for the tool definition, `lib/mcp/tools/<domain>-tools.ts` for the handler, and `lib/mcp/server.ts` for the routing.

**For Zustand store changes:** Check `lib/stores/ui-store.ts` for the expected state slices.

Mark each task:
- **DONE:** the file exists, the implementation is complete, and it follows the established patterns
- **SKIPPED (reason):** the task was intentionally skipped with a documented reason (e.g., "deferred to Wave N+1 per user decision on D. M. YYYY")
- **NOT DONE (reason):** the task was supposed to be done but is not (missing file, stub implementation, incomplete logic)

### Step 4: Run the verification suite

Run these in sequence, collecting results:

**4a: Type check and build**

Launch `ax:test`:
```
Run ax:test and capture the result (PASS or FAIL with details)
```

If ax:test FAILs, the wave cannot close. Record the failure and continue collecting data, but the final verdict will be BLOCKED.

**4b: Safety and pattern review**

Launch `ax:review`:
```
Run ax:review on the diff since the wave started (git diff wave-start-commit...HEAD)
```

If the reviewer returns FAIL, record the blocking issues. The wave cannot close until they are fixed.

**4c: UI verification (if the wave has UI changes)**

Determine if the wave has UI changes:
```bash
cd /Users/Shared/Domain/Code/Personal/ascend && git diff --name-only <wave-start-commit>...HEAD | grep -E "components/|app/\(app\)/|lib/hooks/|lib/stores/" | head -10
```

If UI files changed, launch `ax:verify-ui`:
```
Run ax:verify-ui on the changed UI files
```

If the verifier returns FAIL or NEEDS ATTENTION, record the failing scenarios. The wave cannot close until they are fixed.

**4d: Product critique**

Launch `ax:critique`:
```
Run ax:critique for wave close scope
```

The critic produces a WORLD-CLASS / GOOD / NEEDS WORK / NOT READY verdict. Record it.

If the critic returns NOT READY, the wave SHOULD NOT close (but this is a recommendation, not a hard block, since product quality is subjective). Present the must-fix items and ask the user.

### Step 5: Compile the CLOSE-OUT.md

Write to `${WAVE_DIR}CLOSE-OUT.md`:

```markdown
# Wave N Close-Out: <Wave Title>

**Date:** D. M. YYYY
**Branch:** <branch name>
**Commits:** <first commit sha>..<last commit sha> (<N> commits)

## Delivered Product

<One paragraph matching the "Delivered product" statement from VISION.md. Confirm it matches what was actually shipped.>

## Success Criteria Audit

From VISION.md section 6 and the wave PRD:

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| C1 | <criterion text> | DONE | <file path or test result> |
| C2 | <criterion text> | DONE | <file path or test result> |
| C3 | <criterion text> | SKIPPED | <reason> |
| C4 | <criterion text> | NOT DONE | <reason and remaining work> |

## Task Audit

From TASKS.md:

### Phase 1: <title>
- [x] <task> — DONE (<file>)
- [x] <task> — DONE (<file>)

### Phase 2: <title>
- [x] <task> — DONE (<file>)
- [ ] <task> — NOT DONE: <reason>

### Phase N: Verification
- [x] ax:test — PASS
- [x] ax:review — PASS WITH NOTES
- [x] ax:verify-ui — PASS (N scenarios, 0 failures)
- [x] ax:critique — GOOD (2 should-fix items deferred to Wave N+1)

## Verification Results

### ax:test
```
<paste the ASCEND TEST REPORT output>
```

### ax:review
```
<paste the ASCEND REVIEW VERDICT output>
```

### ax:verify-ui
```
<paste the verifier summary: verdict, scenario count, top issues>
Report: .ascendflow/verification/<filename>.md
```

### ax:critique
```
<paste the ASCEND PRODUCT CRITIQUE verdict and must-fix list>
```

## Deferred Items

Items intentionally moved to a future wave:

- <item> → Wave N+1 (reason)
- <item> → Backlog (reason)

## Lessons Learned

- <what went well>
- <what was harder than expected>
- <what should be done differently in the next wave>

## Final Verdict

**STATUS: COMPLETE | PARTIALLY COMPLETE**

<If COMPLETE: all success criteria DONE, all verification PASS, no blocking items.>
<If PARTIALLY COMPLETE: list exactly what remains and where it was deferred.>
```

### Step 6: Determine the final verdict

Count the results:

- **All success criteria DONE** + **ax:test PASS** + **ax:review PASS or PASS WITH NOTES** + **ax:verify-ui PASS or PASS WITH NOTES** (if applicable) = **COMPLETE**
- **Any success criterion SKIPPED or NOT DONE** = **PARTIALLY COMPLETE**
- **ax:test FAIL or ax:review FAIL** = **BLOCKED** (cannot close; fix and re-run)

### Step 7: Present to the user

```
ASCEND WAVE N CLOSE-OUT
========================

Wave: N — <title>
Date: D. M. YYYY

Success criteria: M of N DONE, K SKIPPED, J NOT DONE
Tasks: P of Q DONE
Verification: ax:test <verdict>, ax:review <verdict>, ax:verify-ui <verdict>
Critique: <verdict>

CLOSE-OUT.md written to: .ascendflow/features/context-v2/wave-N-<slug>/CLOSE-OUT.md

STATUS: COMPLETE | PARTIALLY COMPLETE | BLOCKED

<If COMPLETE:>
Wave N is closed. Ready to start Wave N+1 via ax:wave-start.

<If PARTIALLY COMPLETE:>
Wave N is partially complete. Deferred items:
1. <item> → Wave N+1
2. <item> → Backlog

The CLOSE-OUT.md records these deferrals. Proceed to Wave N+1, or address them now?

<If BLOCKED:>
Wave N cannot close. Blocking issues:
1. <issue from ax:test or ax:review>
2. <issue>

Fix these and re-run ax:wave-close.
```

## Forbidden Phrases

### When any task is NOT DONE or SKIPPED:

You may NOT say:
- "Complete" / "Wave N is done" / "Finished" / "All deliverables shipped" / "Ready for the next wave"
- "Wave N closed successfully"

You MUST say:
- "Partially complete. <N> of <M> criteria met. <K> items deferred." with the full list.

### When verification fails:

You may NOT say:
- "Close-out approved" / "Good to close" / "Wave complete despite failures"
- "The failures are minor" / "These can be fixed later"

You MUST say:
- "BLOCKED. Cannot close Wave N. <N> verification failures. Fix and re-run."

### When the critic says NOT READY:

You MUST relay this honestly:
- "Product critique verdict: NOT READY. Must-fix items: [list]. Recommend addressing before closing."

Do not downplay the critic's verdict.

## Rules

- **ALWAYS read the PRD and TASKS.md in full before auditing.** Never audit from memory.
- **ALWAYS verify by reading actual files**, not by trusting that tasks were "checked off." A checked checkbox in TASKS.md is a claim; the file on disk is the truth.
- **ALWAYS run the full verification suite** (ax:test, ax:review, ax:verify-ui, ax:critique). Skipping any makes the close-out incomplete.
- **ALWAYS write the CLOSE-OUT.md** even if the verdict is PARTIALLY COMPLETE. The file is the permanent record.
- **NEVER close a wave that has FAIL verdicts from ax:test or ax:review.** These are hard blocks, not soft recommendations.
- **NEVER delete a CLOSE-OUT.md.** If a wave needs to be re-opened, the user must do it explicitly.

## Related Skills

- `ax:wave-start`: the opening ritual that checks prerequisites before starting a wave
- `ax:test`: runs the type check and build
- `ax:review`: runs the safety and pattern review
- `ax:verify-ui`: runs the UI verification via Playwright
- `ax:critique`: runs the product quality critique
- `ax:save`: save session state if the close-out reveals work that needs another session
