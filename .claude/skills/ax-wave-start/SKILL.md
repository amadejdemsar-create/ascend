---
name: ax:wave-start
description: Pre-flight check before starting a Context v2 wave. Verifies that the prior wave is closed, git is clean, the wave's PRD and TASKS.md exist, the branch is correct, and the baseline build is green. Refuses to start if any prerequisite is missing. Use this at the beginning of every wave.
user_invocable: true
---

# ax:wave-start

Pre-flight verification ritual before beginning work on a Context v2 wave. This skill ensures every prerequisite is met and the codebase is in a known-good state before any wave work begins.

## Execution Quality Bar (read first)

This skill enforces the Ascend quality bar from `/Users/Shared/Domain/Code/Personal/ascend/CLAUDE.md` and the global rule in `~/.claude/CLAUDE.md`.

**This is a gate, not a suggestion.** If any prerequisite fails, the skill refuses to start the wave and explains exactly what needs to be done. No overrides, no "start anyway." The discipline exists because mid-wave discoveries of unresolved prior-wave issues cost 10x more to fix than catching them at the gate.

## When to Use

- At the beginning of every Context v2 wave (Wave 0 through Wave 10)
- After `/clear` when resuming a wave (re-run to verify state is still clean)
- When the user says "let's start Wave N"

## When NOT to use

- For non-wave work (bug fixes, polish sprints, one-off features)
- If the Context v2 roadmap has not been created yet (VISION.md must exist)

## Usage

- `ax:wave-start <N>` — pre-flight for Wave N (e.g., `ax:wave-start 0`)
- `ax:wave-start` — will ask which wave to start

## Workflow

### Step 1: Identify the wave

If the user passed a wave number, use it. Otherwise, determine the next wave:

```bash
# List existing wave directories
ls -d /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/context-v2/wave-*/ 2>/dev/null

# Check for CLOSE-OUT.md in each
for d in /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/context-v2/wave-*/; do
  if [ -f "$d/CLOSE-OUT.md" ]; then
    echo "CLOSED: $d"
  else
    echo "OPEN: $d"
  fi
done 2>/dev/null
```

The next wave is the lowest-numbered wave without a CLOSE-OUT.md, or the next wave number after the highest closed wave.

### Step 2: Verify the prior wave is closed

For Wave N, check that Wave N-1 has a CLOSE-OUT.md:

```bash
PRIOR_WAVE_DIR=$(ls -d /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/context-v2/wave-$((N-1))-*/ 2>/dev/null | head -1)

if [ -z "$PRIOR_WAVE_DIR" ]; then
  echo "NO PRIOR WAVE DIRECTORY FOUND"
elif [ -f "${PRIOR_WAVE_DIR}CLOSE-OUT.md" ]; then
  echo "PRIOR WAVE CLOSED"
  cat "${PRIOR_WAVE_DIR}CLOSE-OUT.md" | head -30
else
  echo "PRIOR WAVE NOT CLOSED"
fi
```

**If the prior wave is not closed:**
- Read its TASKS.md and identify remaining items
- Report: "Wave N-1 is not closed. Remaining tasks: [list]. Run `ax:wave-close` for Wave N-1 first, or explicitly skip it with user approval."
- STOP. Do not proceed.

**Exception:** Wave 0 has no prior wave. Skip this check.

Also verify the CLOSE-OUT.md does not contain any "SKIPPED" or "NOT DONE" items:

```bash
grep -i "SKIPPED\|NOT DONE\|not done\|skipped" "${PRIOR_WAVE_DIR}CLOSE-OUT.md" 2>/dev/null
```

If any items were skipped, warn: "Wave N-1 closed with skipped items: [list]. Confirm these are intentionally deferred, not forgotten."

### Step 3: Verify git state is clean

```bash
cd /Users/Shared/Domain/Code/Personal/ascend && git status --porcelain
cd /Users/Shared/Domain/Code/Personal/ascend && git branch --show-current
```

**If the working tree is dirty:**
- Report: "Uncommitted changes detected. Commit or stash before starting Wave N."
- STOP.

**Branch check:**
- If on `main`: acceptable for starting a new wave. Recommend creating a wave branch.
- If on a wave branch (e.g., `wave-1-graph-foundation`): verify it matches the wave being started.
- If on an unrelated branch: warn and ask the user to switch.

### Step 4: Verify wave planning documents exist

```bash
WAVE_DIR="/Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/context-v2/wave-${N}-<slug>"

# Check if any wave directory matches
WAVE_DIR=$(ls -d /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/context-v2/wave-${N}-*/ 2>/dev/null | head -1)

if [ -z "$WAVE_DIR" ]; then
  echo "NO WAVE DIRECTORY"
elif [ -f "${WAVE_DIR}PRD.md" ] && [ -f "${WAVE_DIR}TASKS.md" ]; then
  echo "PLANNING DOCS EXIST"
else
  echo "MISSING DOCS"
  ls "$WAVE_DIR" 2>/dev/null
fi
```

**If the wave directory does not exist:**
- Report: "Wave N planning documents do not exist. Run `ax:plan` first to create the PRD and TASKS.md."
- STOP.

**If PRD.md is missing:**
- Report: "Wave N directory exists but PRD.md is missing. Create the PRD before starting."
- STOP.

**If TASKS.md is missing:**
- Report: "Wave N has a PRD but no TASKS.md. Run `ax:plan` to generate the implementation tasks."
- STOP.

If both exist, read them:

```bash
cat "${WAVE_DIR}PRD.md"
cat "${WAVE_DIR}TASKS.md"
```

### Step 5: Verify baseline build is green

```bash
cd /Users/Shared/Domain/Code/Personal/ascend && npx tsc --noEmit 2>&1 | tail -5
cd /Users/Shared/Domain/Code/Personal/ascend && npm run build 2>&1 | tail -10
```

**If TypeScript fails:** STOP. "Baseline TypeScript check has errors. Fix before starting Wave N."
**If build fails:** STOP. "Baseline build fails. Fix before starting Wave N."

Both must pass. Starting a wave on a broken baseline means you cannot distinguish pre-existing errors from wave-introduced errors.

### Step 6: Cross-platform check (if packages/ exists)

If the monorepo has been converted (Wave 0 complete):

```bash
ls -d /Users/Shared/Domain/Code/Personal/ascend/packages/*/src/ 2>/dev/null
```

If packages exist, run `ax:cross-platform-check` as part of the pre-flight. Any RED violation must be resolved before starting the next wave.

### Step 7: Read the wave scope from VISION.md

```bash
# Read the specific wave section from VISION.md
grep -A 50 "### Wave ${N}:" /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/context-v2/VISION.md | head -60
```

Extract:
- **Delivered product:** the one-sentence promise
- **Scope:** the list of deliverables
- **Sized:** estimated duration

### Step 8: Present the wave checklist and ask for confirmation

Print a structured pre-flight report:

```
ASCEND WAVE N PRE-FLIGHT
========================

Wave: N — <slug>
Date: D. M. YYYY
Delivered product: "<one-sentence from VISION.md>"
Estimated duration: <from VISION.md>

Pre-flight checks:
  Prior wave (N-1) closed: PASS | FAIL | N/A (first wave)
  Git state clean: PASS | FAIL
  Branch: <branch name>
  Wave PRD exists: PASS | FAIL
  Wave TASKS.md exists: PASS | FAIL
  TypeScript baseline: PASS | FAIL
  Build baseline: PASS | FAIL
  Cross-platform check: PASS | FAIL | N/A (pre-monorepo)

VERDICT: READY TO START | BLOCKED (N prerequisites missing)

Wave deliverables (from TASKS.md):
  [ ] Phase 1: <task summary>
  [ ] Phase 2: <task summary>
  [ ] Phase 3: <task summary>
  ...
  [ ] Final: Run ax:test, ax:review, ax:verify-ui, ax:wave-close

Confirm: reply "start wave N" to begin execution.
```

**If any check is FAIL:** do not show the "Confirm" line. Instead show:

```
BLOCKED: Cannot start Wave N.

Fix these prerequisites first:
1. <what to fix>
2. <what to fix>

After fixing, re-run ax:wave-start <N>.
```

### Step 9: On confirmation, set up the wave

After the user says "start wave N":

1. **Create the wave branch** (if not already on one):
   ```bash
   cd /Users/Shared/Domain/Code/Personal/ascend && git checkout -b wave-${N}-<slug>
   ```

2. **Update the PRD status** to `in-progress`:
   Read the PRD, change `Status: planning` to `Status: in-progress`, write it back.

3. **Print the first task** from TASKS.md and offer to begin:
   ```
   Wave N started. First task:

   Phase 1: <task description>
   Files: <file paths from TASKS.md>

   Shall I begin Phase 1?
   ```

## Rules

- **NEVER skip the prior wave close check.** The wave close ritual ensures all deliverables were verified. Starting a new wave on top of an incomplete one means gaps accumulate.
- **NEVER start on a dirty git tree.** Uncommitted changes make it impossible to distinguish wave work from prior work.
- **NEVER start without a green baseline.** If tsc or build fails before the wave starts, you cannot tell whether new errors are yours or inherited.
- **NEVER start without planning documents.** The PRD and TASKS.md are the scope contract. Without them, scope creep is guaranteed.
- **ALWAYS present the deliverables checklist.** The team must see the full scope before confirming.

## Forbidden Phrases When Prerequisites Fail

If ANY pre-flight check is FAIL, you may NOT say:
- "Ready to start" / "Let's begin" / "Wave N is go" / "Starting now"
- "We can work around this" / "This is minor, let's proceed"

You MUST say:
- "BLOCKED. <N> prerequisites failed. Fix before starting Wave N."

## Related Skills

- `ax:wave-close`: the counterpart ritual that closes a wave
- `ax:plan`: creates the PRD and TASKS.md that this skill checks for
- `ax:test`: runs the baseline build check that this skill includes
- `ax:cross-platform-check`: runs the package boundary check that this skill includes for post-Wave-0 waves
- `ax:save`: save session state if a wave is paused mid-execution
