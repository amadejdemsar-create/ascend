---
name: ax:deploy-check
description: Pre-deploy validation for Ascend. Runs the full build, checks for uncommitted changes, verifies Prisma migrations are in sync, checks that CLAUDE.md rules were followed in recent changes, and warns about any danger zone touches. Used before pushing to main (which triggers auto-deploy via Dokploy).
user_invocable: true
---

# ax:deploy-check

Runs every pre-flight check before Ascend is deployed to production. Ascend auto-deploys to `ascend.nativeai.agency` via Dokploy on every push to `main`. This skill makes sure the push is safe.

## When to Use

- Immediately before `git push origin main`.
- When preparing a release.
- After finishing a feature and wanting to confirm everything is green.
- When a previous deploy failed and you want to catch the issue before trying again.

## Workflow

Run each of these checks in sequence. Stop and report if any FAIL.

### Check 1: Clean working tree or explicit commit

```bash
cd /Users/Shared/Domain/Code/Personal/goals && git status --porcelain
```

- If empty: PASS. The tree is clean.
- If there are uncommitted changes: Ask the user whether to commit them first. If they say "deploy with uncommitted changes", that is impossible (deploy is based on the remote branch). Either commit, stash, or abort.

### Check 2: On the main branch

```bash
cd /Users/Shared/Domain/Code/Personal/goals && git branch --show-current
```

- If `main`: PASS.
- If another branch: Ask the user whether they want to merge into main first, or deploy from that branch (which will not trigger the Dokploy auto-deploy on main).

### Check 3: Up to date with remote

```bash
cd /Users/Shared/Domain/Code/Personal/goals && git fetch origin main && git status
```

- If ahead of origin/main: OK, there are commits to push.
- If behind: Warn the user to pull first; otherwise their push may not go through cleanly.
- If diverged: STOP. Tell the user to resolve the divergence manually. Never force push.

### Check 4: Production build passes

```bash
cd /Users/Shared/Domain/Code/Personal/goals && npm run build
```

Use a long timeout (at least 180000ms). This is the same build Dokploy runs on the VPS. If it fails locally, it will fail in production.

If the build fails, extract the first 10 errors and stop. Do not proceed.

### Check 5: TypeScript passes

```bash
cd /Users/Shared/Domain/Code/Personal/goals && npx tsc --noEmit
```

Usually redundant with Check 4, but catches issues the build may miss (for example, config files that tsc checks but next build does not).

### Check 6: Prisma migrations in sync

Check two things:

a) Are there pending schema changes not yet migrated?

```bash
cd /Users/Shared/Domain/Code/Personal/goals && npx prisma migrate status
```

Parse the output. If there are drift or pending migrations, STOP. Tell the user to run `npx prisma migrate dev --name <name>` first.

b) Is the `search_vector` tsvector migration present?

```bash
cd /Users/Shared/Domain/Code/Personal/goals && ls prisma/migrations/ | grep -i search
```

Should exist. If missing, flag as a critical warning (the full-text search on context entries depends on it).

### Check 7: Forbidden Prisma commands not in scripts

Grep for any forbidden command in `package.json`, `Dockerfile`, and recent commits:

```bash
cd /Users/Shared/Domain/Code/Personal/goals && grep -rE 'prisma db push|prisma migrate reset' package.json Dockerfile scripts/ 2>/dev/null
```

If any match, STOP. These commands drop the `search_vector` column. CLAUDE.md safety rule 6.

### Check 8: Recent changes respect CLAUDE.md rules

Launch the `ascend-reviewer` agent on the changes since origin/main:

```bash
cd /Users/Shared/Domain/Code/Personal/goals && git diff origin/main...HEAD
```

If the diff is non-empty, pass it to the reviewer. If the reviewer returns FAIL, STOP.

### Check 9: Danger zones untouched or handled

The reviewer will flag danger zone touches. For each:

- **Todo completion flow** (`lib/services/todo-service.ts`, `gamification-service.ts`): If touched, verify the implementer either wrapped it in a transaction or explicitly acknowledged the risk.
- **Prisma schema changes on ContextEntry**: Verify `search_vector` is preserved.
- **Recurring services**: Note the duplication if touched.
- **fetchJson duplication**: Suggest extraction if multiple hook files changed.

Do not fail the check on danger zone touches, but surface them prominently.

### Check 10: Environment variables documented

If the change added new environment variables (via grep for `process.env.`), verify they are documented in `.env.example` or README:

```bash
cd /Users/Shared/Domain/Code/Personal/goals && grep -rn 'process\.env\.' lib/ app/ | grep -v NEXT_PUBLIC_ | grep -v NODE_ENV
```

For each non-public env var, check it exists in `.env.example`. Warn if missing.

## Output Format

**All checks pass**:

```
Ascend Deploy Check: READY

Branch: main (2 commits ahead of origin/main)
Build: PASS (51.3s)
TypeScript: PASS
Prisma migrations: in sync
Danger zones: none touched
Review: PASS

Safe to push. Run: git push origin main
Dokploy will auto-deploy to ascend.nativeai.agency.
```

**Any check fails**:

```
Ascend Deploy Check: BLOCKED

Branch: main (OK)
Build: FAIL

Build errors:
  app/api/goals/[id]/route.ts:34:10
    Type '{ id: string }' is not assignable to ...

Fix and re-run ax:deploy-check.
```

## Rules

- **Never proceed on a failed check.** Every check is a blocker. Do not "deploy anyway".
- **Never bypass danger zone warnings.** Surface them every time.
- **Never run forbidden Prisma commands** even if they would "fix" a pending migration warning.
- **Never force push to main.** If there is divergence, stop and let the user resolve.
- **Always run the full build**, not just tsc. Dokploy runs the build on the VPS.

## Related Skills

- `ax:test` runs build + type check without the deploy gate.
- `ax:review` runs the reviewer on a diff.
- `ax:save` snapshots a session before you deploy.

## Deployment Facts (for reference)

- Host: Dokploy (dokploy-personal) on a Hostinger VPS.
- Domain: ascend.nativeai.agency.
- Trigger: push to main via GitHub provider.
- Build: Docker from the root `Dockerfile`.
- Database: managed Postgres in Dokploy.
- Env vars: set in Dokploy UI, not in the repo.

## Mandatory Completion Checklist

**Before declaring "ready to deploy" or "safe to push", you MUST present the following checklist with every check marked explicitly. This is the completion gate for the entire skill.**

The global `Execution Quality Bar` in `~/.claude/CLAUDE.md` and the Ascend-specific checks in `/Users/Shared/Domain/Code/Personal/goals/CLAUDE.md` apply in full.

### Required output format

```
ASCEND DEPLOY CHECK RESULT
==========================

Check 1 (Clean working tree): DONE | SKIPPED (reason) | FAILED (reason)
Check 2 (On main branch): DONE | SKIPPED (reason) | FAILED (reason)
Check 3 (Up to date with remote): DONE | SKIPPED (reason) | FAILED (reason)
Check 4 (Production build passes): DONE | FAILED (first 3 errors inline)
Check 5 (TypeScript passes): DONE | FAILED (first 3 errors inline)
Check 6 (Prisma migrations in sync): DONE | FAILED (reason)
Check 7 (No forbidden Prisma commands): DONE | FAILED (match location)
Check 8 (ascend-reviewer on diff): DONE (verdict: PASS | PASS WITH NOTES) | FAILED (verdict: FAIL)
Check 9 (Danger zones untouched or handled): DONE | NOTED (list)
Check 10 (Env vars documented): DONE | NOTED (missing var names)

VERDICT: READY TO DEPLOY | BLOCKED
```

### Forbidden phrases when any check failed

If ANY of the 10 checks is FAILED (or SKIPPED without a valid reason), you may NOT say:
- "Ready to deploy" / "Safe to push" / "Ready to ship" / "Good to go" / "All clear" / "All green"
- "Checks pass" (when any single check failed)
- "Deploy it" / "Push to main"

You MUST say instead:
- "BLOCKED. Check <N> failed: <reason>. Fix and re-run `ax:deploy-check`."
- "Not ready to deploy. <N> of 10 checks failed. Blockers: [exact list with file:line]."

A single failed check is a hard block. Do not rationalize. Do not "deploy anyway". The deploy hook rebuilds on push, and a broken build locally will break production.
