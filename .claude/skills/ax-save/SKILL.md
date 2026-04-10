---
name: ax:save
description: Save the current Ascend session state to .ascendflow/sessions/ so it can be resumed later. Captures what was worked on, which files changed, what is left, and any open questions. Produces a resumable session markdown file that a future Claude session can read to pick up where you left off.
user_invocable: true
---

# ax:save

Snapshots the current session so the next Claude session (or a human) can resume without losing context. Writes to `.ascendflow/sessions/<YYYY-MM-DD-HHMM>-<slug>.md`.

## Mandatory State Capture Format

Every session file MUST capture the following four pieces of state explicitly. A session file missing any of these is incomplete and will fail to resume cleanly. This is non-negotiable.

1. **What was worked on** (one or two sentences plus a reference to the active `.ascendflow/features/<slug>/` if any)
2. **What is DONE** (checked items from the active `TASKS.md`, plus any off-plan work with git diff references)
3. **What is LEFT** (unchecked items from `TASKS.md`, plus the next concrete step)
4. **Blockers** (anything preventing progress: failed build, unresolved question, pending user decision, API pricing lookup needed, design choice pending)

If a blocker exists, the session state MUST be `blocked` and the blocker must be the first thing the next session reads.

## Reference Examples

Before writing the first session file in this directory, read an existing example to match the quality bar:

```bash
ls /Users/Shared/Domain/Code/Personal/goals/.ascendflow/sessions/ 2>/dev/null | tail -5
```

Read the most recent example's structure. If the directory is empty, this is the first session file and you set the bar. Look especially at the "Files Being Worked On" section, which is the single most important section for a future resume.

## When to Use

- End of a work session when you are about to stop.
- Context window is filling up and you want to `/clear` soon.
- Switching between features and want to save progress on the current one.
- Before a deploy or a pair programming handoff.

## Workflow

### Step 1: Gather context

Run these in parallel:

```bash
cd /Users/Shared/Domain/Code/Personal/goals && git status
cd /Users/Shared/Domain/Code/Personal/goals && git diff --stat
cd /Users/Shared/Domain/Code/Personal/goals && git log --oneline -20
cd /Users/Shared/Domain/Code/Personal/goals && git branch --show-current
```

Also check if there is an active feature plan:

```bash
ls /Users/Shared/Domain/Code/Personal/goals/.ascendflow/features/ 2>/dev/null
```

### Step 2: Ask the user for a brief summary

Ask these questions (briefly, non-intrusively):
1. What were you working on in one sentence? (for the session slug)
2. What is the current state? (in-progress, blocked, ready to test, ready to commit)
3. What is the next concrete step?
4. Any open questions or decisions you want flagged?

If the user wants to skip the questions, derive what you can from git state.

### Step 3: Generate the session filename

Format: `<YYYY-MM-DD-HHMM>-<slug>.md`

Example: `2026-04-08-1430-archive-goals-service.md`

Slug is kebab-case from the user's summary. Use Europe/Ljubljana timezone for the timestamp.

### Step 4: Write the session file

Path: `/Users/Shared/Domain/Code/Personal/goals/.ascendflow/sessions/<filename>`

Structure:

```markdown
# Ascend Session: <Title>

**Date**: D. M. YYYY (European format)
**Time**: HH:MM Europe/Ljubljana
**Branch**: <branch name>
**State**: in-progress | blocked | ready-to-test | ready-to-commit

## What I was working on

<One or two sentences summarizing the session.>

## Files Being Worked On

Key files the next session must read to pick up context:

- `path/to/file1.ts` - <why it matters>
- `path/to/file2.tsx` - <why it matters>
- `.ascendflow/features/<slug>/PRD.md` - <if a plan exists>
- `.ascendflow/features/<slug>/TASKS.md` - <if a task list exists>

## Git State

**Branch**: <branch>
**Ahead of origin**: N commits
**Uncommitted changes**: Y | N

```
<git status output>
```

**Recent commits**:

```
<git log --oneline -5 output>
```

## Changes in Progress

<git diff --stat output>

Summary of what the diff does in plain English.

## Current State

What is done:
- [x] <done task>
- [x] <done task>

What is in progress:
- [ ] <in-progress task, with current blocker if any>

What is next:
- [ ] <next concrete step>
- [ ] <following step>

## Open Questions

- <Anything unresolved that needs a decision>

## Context the Next Session Needs

<Any facts, constraints, or discoveries from this session that are not captured in the code or the PRD. Examples:>
- <user preference discovered during the session>
- <library quirk found>
- <decision made and why>

## Commands to Run When Resuming

```bash
cd /Users/Shared/Domain/Code/Personal/goals
git status
cat .ascendflow/sessions/<this-file>.md  # Read this file
cat <key-files-from-above>
```

## How to Resume

1. Read this file end to end.
2. Read the Files Being Worked On above in order.
3. Check `git status` to confirm the tree matches what is described here.
4. If state is "in-progress" or "blocked", continue the in-progress task.
5. If state is "ready-to-test", run `ax:test`.
6. If state is "ready-to-commit", run `ax:deploy-check`.
```

### Step 5: Confirm and hand off

Print the session path to the user:

```
Session saved.

File: .ascendflow/sessions/2026-04-08-1430-archive-goals-service.md
State: in-progress

To resume later:
  Read .ascendflow/sessions/2026-04-08-1430-archive-goals-service.md
Or say: "resume ascend session archive-goals-service"
```

## Rules

- **Always include file paths**, not abstract descriptions. The next session needs to know exactly what to read.
- **Always capture git state** even if the tree is clean. Knowing "last commit was X, branch was Y" is useful.
- **Never delete old sessions automatically.** They are low-cost history. The user deletes manually.
- **Always use Europe/Ljubljana timezone** for the timestamp in the body. European date format (D. M. YYYY) in the body; ISO for the filename.
- **If a feature PRD exists**, link to it. The PRD and session are complementary: PRD is the "what" and "why", session is the "where we are right now".

## Related Skills

- `ax:plan` creates the PRD and task list that a session references.
- `ax:review` is often the last step before saving.
- `ax:deploy-check` is run at the end of a session before pushing.
