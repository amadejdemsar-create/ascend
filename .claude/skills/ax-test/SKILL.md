---
name: ax:test
description: Smart test runner for Ascend. Since there is no test suite yet, this runs `npx tsc --noEmit` for a type check and `pnpm build` for a full production build verification. Also checks for console errors in dev mode if requested. Reports what's broken with actionable fixes.
user_invocable: true
---

# ax:test

Ascend has no Jest or Vitest test suite (yet). This skill is the practical substitute: it runs the type checker and the production build, which together catch the vast majority of regressions. App Router route-level TypeScript errors only surface in the build, not the dev server, so both are required.

## When to Use

- Before committing any change.
- Before pushing to main (the Dokploy deploy hook rebuilds on push).
- After touching Prisma schemas, API routes, or hook files.
- As the final phase in `ax:plan` task lists.
- Whenever you touched multiple files and want fast confidence.

## Workflow

### Step 1: Understand the scope

If the user passed args, honor them:
- `ax:test` -> full type check + build
- `ax:test tsc` -> type check only (fast, ~5-20s)
- `ax:test build` -> build only (slower, ~30-90s)
- `ax:test dev` -> type check + start dev server in background and watch for console errors for 15 seconds

Default: run type check first, then build.

### Step 2: Run the type check

```bash
cd /Users/Shared/Domain/Code/Personal/ascend && pnpm typecheck
```

Capture exit code and stderr. Parse the output to extract:
- Error count
- First 10 errors with file, line, column, message

If type check passes, proceed. If it fails, stop and report the errors. Do not run the build on top of a broken type check; the build error list will be noisy and overlap.

### Step 3: Run the build

```bash
cd /Users/Shared/Domain/Code/Personal/ascend && pnpm build
```

The build takes 30 to 90 seconds depending on the machine. Use a long timeout (at least 180000ms).

Capture exit code and output. Parse for:
- TypeScript errors (different formatter than `tsc` alone)
- Route compilation errors
- Prisma client errors
- Linting errors (if ESLint is part of the build)

### Step 4: Optionally run dev mode sanity check

If the user asked for `ax:test dev`:
1. Start the dev server in background: `pnpm dev &` (via `run_in_background: true`).
2. Wait a reasonable time for it to start listening.
3. Read the console output.
4. Look for: Prisma client errors, webpack errors, React errors, 500 responses in logs.
5. Kill the dev server.

### Step 5: Report

Print a compact summary followed by details if anything failed.

**Success case**:

```
Ascend Test Report

Type check: PASS (3.4s)
Build: PASS (42.1s)

All checks passed. Safe to commit.
```

**Failure case**:

```
Ascend Test Report

Type check: FAIL (5 errors)
Build: SKIPPED (type check failed)

Errors:
1. lib/services/goal-service.ts:45:20
   Property 'userId' does not exist on type 'CreateGoalInput'.
   Fix: Add userId to the CreateGoalInput schema in lib/validations.ts.

2. ...

Fix the type errors first, then re-run ax:test.
```

## Rules

- **Always run tsc before build.** The type check is 10x faster and gives clearer error messages. If tsc fails, build will too, with noisier output.
- **Always run the build before considering any change done.** Dev server does not catch all App Router errors. CLAUDE.md safety rule 5 exists because of this.
- **Never skip the build to save time.** The difference between a working deploy and a broken deploy is usually a build-only error.
- **Extract actionable errors.** Do not dump the full stderr. Parse the first 10 errors with file, line, and a suggested fix where obvious.
- **Kill background processes.** If you started `pnpm dev`, kill it before returning.

## Known False Negatives

These errors do NOT surface in tsc or build but can still break the app:
- Prisma schema out of sync with the database (run `npx prisma migrate dev` first).
- Missing environment variables (`NEXT_PUBLIC_API_KEY`, `DATABASE_URL`).
- Race conditions in React Query cache invalidation.
- Runtime errors in MCP tool handlers (only surface when the tool is called).

When reporting success, briefly note these are not covered by the skill so the user knows the limits.

## Known False Positives

These errors may appear but do not block the dev workflow:
- ESLint warnings that don't fail the build.
- Next.js deprecation warnings.
- Prisma generator notices.

Filter these out of the report unless the user explicitly asks for everything.

## Pass/Fail Criteria

This skill has explicit pass/fail criteria. There is no middle ground.

**PASS** requires ALL of:
- `npx tsc --noEmit` exit code 0, zero errors
- `pnpm build` exit code 0, zero errors (when run, which is the default)
- If `ax:test dev` was requested: no Prisma client errors, no webpack errors, no React errors, no 500 responses in the dev server logs during the 15-second watch window

**FAIL** means any of:
- Type check returned any error
- Build returned any error
- Dev mode sanity check (if requested) surfaced any error

No partial credit. No "mostly passing". No "should be fine".

## Required Output Format

Every run of this skill MUST produce an explicit per-check result:

```
ASCEND TEST REPORT
==================

Type check: PASS (Ns) | FAIL (N errors)
Build: PASS (Ns) | FAIL (N errors) | SKIPPED (reason)
Dev sanity (optional): PASS | FAIL | NOT RUN

VERDICT: PASS | FAIL
```

If VERDICT is FAIL, include the first 10 errors with file, line, column, and message. Do NOT print the full stderr; extract actionable errors only.

## Forbidden Phrases When Tests Fail

If type check OR build returns any error, you may NOT say:
- "Tests pass" / "All passing" / "Green" / "Safe to commit" / "Ready to push"
- "Looks good" / "No issues" / "Everything works"

You MUST say instead:
- "FAIL. Type check returned <N> errors. First error: <file>:<line> <message>. Fix and re-run `ax:test`."
- "FAIL. Build failed at <file>:<line>. Fix and re-run `ax:test`."

A single type error is a FAIL, not a warning. The whole point of this skill is to catch errors before they hit the build server. Softening a failure defeats the purpose.

## Future

When Ascend adds a real test suite, this skill should:
- Run `pnpm test` first.
- Then tsc.
- Then build.
- Report coverage if available.

Until then, tsc + build is the best available signal.
