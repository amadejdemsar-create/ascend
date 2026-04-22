# Implementation Tasks: Wave 0 — Platform Foundation

**Parent:** [PRD.md](./PRD.md) · [VISION.md](../VISION.md)
**Sizing:** 10 working days solo. Order matters — each task has prerequisites from prior phases.
**Zero user-visible change.** Every phase ends with `ax:verify-ui` passing.

> Implementation is delegated to `ascend-dev`. Visual/layout checks to `ascend-ux`. Every phase ends with `ax:review` + `ax:verify-ui` before moving to the next phase. If any verification fails, STOP and fix before continuing.

---

## Phase 1: Monorepo conversion (Days 1–2)

Prerequisite: clean `git status`. Commit everything before starting.

- [ ] **1.1 Install pnpm globally:** `npm install -g pnpm@latest`. Confirm with `pnpm --version`. Add pnpm to `package.json` via `packageManager` field.
- [ ] **1.2 Create root `pnpm-workspace.yaml`:**
  ```yaml
  packages:
    - "apps/*"
    - "packages/*"
  ```
- [ ] **1.3 Create `apps/web/` directory. Move existing code into it:**
  - Move `app/`, `components/`, `lib/`, `prisma/`, `public/`, `middleware.ts`, `instrumentation.ts`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `tailwind.config.ts` (if present), `postcss.config.mjs`, `eslint.config.mjs`, `components.json` (shadcn).
  - Move `package.json` — but first split: root `package.json` keeps only monorepo devDeps (pnpm, turbo if added, root lint config). `apps/web/package.json` gets all Next.js/React/etc. dependencies.
  - Move `.next/` (if exists) — or better, delete and rebuild after migration.
- [ ] **1.4 Rewrite `apps/web/tsconfig.json`:** ensure `"baseUrl": "."` and `"paths": { "@/*": ["./*"] }` still resolve from `apps/web`. No changes to import syntax in source files — `@/` continues to point at `apps/web/`.
- [ ] **1.5 Create root `tsconfig.base.json`:** shared compiler options. `apps/web/tsconfig.json` extends it.
- [ ] **1.6 Create root `package.json`** with scripts that delegate to the web app:
  ```json
  {
    "name": "ascend-monorepo",
    "private": true,
    "scripts": {
      "dev": "pnpm --filter @ascend/web dev",
      "build": "pnpm --filter @ascend/web build",
      "lint": "pnpm --filter @ascend/web lint",
      "typecheck": "pnpm -r exec tsc --noEmit"
    },
    "packageManager": "pnpm@9.x.x",
    "devDependencies": { ... }
  }
  ```
- [ ] **1.7 Rename `apps/web/package.json` name to `@ascend/web`**. Keep all scripts (`dev`, `build`, `start`, `lint`).
- [ ] **1.8 Update `.gitignore`** at root: include `apps/*/.next/`, `apps/*/node_modules/`, `packages/*/dist/`, `packages/*/node_modules/`, `**/*.tsbuildinfo`.
- [ ] **1.9 Delete root `node_modules/` and root `package-lock.json`. Run `pnpm install`** at root.
- [ ] **1.10 Run `pnpm --filter @ascend/web dev`** — app starts on localhost:3000 with no errors.
- [ ] **1.11 Run `pnpm --filter @ascend/web build`** — production build succeeds with zero TypeScript errors.
- [ ] **1.12 Commit**: `chore(monorepo): convert to pnpm workspaces, move app to apps/web`.

Verification after Phase 1: `/ax:verify-ui` full pass. If any scenario fails, fix before Phase 2.

---

## Phase 2: Schema prep + `packages/core` (Day 2 afternoon)

- [ ] **2.1 Create `packages/core/` skeleton:** `package.json` (name: `@ascend/core`, exports `./schemas`, `./types`, `./constants`), `tsconfig.json` extending base, `src/` directory.
- [ ] **2.2 Decide on `workspaceId` policy** for Wave 0 (see PRD Open Question 4). Recommended: add nullable `workspaceId String?` to `User`, `Goal`, `Todo`, `ContextEntry`, `Category`, `File` in Phase 3. Revisit here before Phase 3.
- [ ] **2.3 Extract Zod schemas from `apps/web/lib/validations.ts`** into `packages/core/src/schemas/`. Split by domain: `goal-schemas.ts`, `todo-schemas.ts`, `context-schemas.ts`, `category-schemas.ts`, `shared-schemas.ts` (enums, common). Export barrel from `packages/core/src/schemas/index.ts`.
- [ ] **2.4 Extract enum constants** (`HORIZON_ENUM`, `STATUS_ENUM`, `PRIORITY_ENUM`, `TODO_STATUS_ENUM`) to `packages/core/src/constants/enums.ts`. `apps/web/lib/mcp/schemas.ts` imports them from `@ascend/core`.
- [ ] **2.5 Extract `lib/constants.ts`** XP/level tables to `packages/core/src/constants/gamification.ts`.
- [ ] **2.6 Rewrite `apps/web/lib/validations.ts`** to be a barrel re-export from `@ascend/core/schemas`. This keeps existing imports (`from "@/lib/validations"`) working while the source of truth moves.
- [ ] **2.7 Add `@ascend/core` to `apps/web/package.json`** as `"@ascend/core": "workspace:*"`. Run `pnpm install`.
- [ ] **2.8 Confirm zero-regression:** `pnpm typecheck`, `pnpm build`, `/ax:verify-ui` full pass.
- [ ] **2.9 Commit**: `feat(core): extract Zod schemas and enums to @ascend/core`.

---

## Phase 3: Prisma migration — File + Session (Day 3 morning)

- [ ] **3.1 Edit `apps/web/prisma/schema.prisma`:** add `File` model, `FileStatus` enum, `Session` model per PRD. Add relations on `User`.
- [ ] **3.2 (If 2.2 decided yes) add nullable `workspaceId String?`** to `User`, `Goal`, `Todo`, `ContextEntry`, `Category`, `File`. Index each.
- [ ] **3.3 Run `pnpm --filter @ascend/web exec prisma migrate dev --name wave0_platform_foundation`**.
- [ ] **3.4 Inspect generated SQL** in `apps/web/prisma/migrations/`. Confirm: only `CREATE TABLE` for `File`, `Session`; only `ALTER TABLE ADD COLUMN` for nullable workspaceId; no touches on `search_vector`, `pg_trgm`, or other raw-SQL objects.
- [ ] **3.5 Run `pnpm --filter @ascend/web exec prisma generate`** to regenerate client.
- [ ] **3.6 Verify `search_vector` survives:** query `SELECT column_name FROM information_schema.columns WHERE table_name='ContextEntry' AND column_name='search_vector';` — should return one row.
- [ ] **3.7 Commit**: `feat(db): add File and Session models, nullable workspaceId scaffolding`.

---

## Phase 4: `packages/api-client` + `fetchJson` dedup (Days 3 afternoon – 4)

- [ ] **4.1 Create `packages/api-client/` skeleton.** `package.json` (name: `@ascend/api-client`), `tsconfig.json`, `src/client.ts`, `src/errors.ts`.
- [ ] **4.2 Implement `apiClient.fetch(path, options)`** in `src/client.ts`:
  - Accepts optional `baseUrl` (defaults to `""` for same-origin, overridable for native).
  - Accepts optional auth header factory (passed at construction or per-call).
  - Adds `Content-Type: application/json` when body is object.
  - Throws typed `ApiError` with status + parsed body on non-2xx.
  - Returns parsed JSON on 2xx.
- [ ] **4.3 Implement helper builders:** `apiClient.get`, `apiClient.post`, `apiClient.put`, `apiClient.patch`, `apiClient.delete`. Each returns a typed promise.
- [ ] **4.4 Add `@ascend/api-client`** to `apps/web/package.json` as `workspace:*`. Run `pnpm install`.
- [ ] **4.5 Create `apps/web/lib/api-client.ts`:** single configured instance:
  ```ts
  import { createApiClient } from "@ascend/api-client";
  export const api = createApiClient({
    baseUrl: "",
    getAuthHeaders: () => ({ /* web uses cookies, no headers needed for session auth */ }),
  });
  ```
- [ ] **4.6 Replace `fetchJson` in `apps/web/lib/hooks/use-goals.ts`** with `api.get/post/put/delete`. All queries + mutations updated.
- [ ] **4.7 Repeat 4.6 for `use-todos.ts`, `use-context.ts`, `use-categories.ts`, `use-dashboard.ts`.** Verify each hook file no longer defines `fetchJson`.
- [ ] **4.8 Grep verification:** `rg "fetchJson" apps/web/` should return zero matches in `lib/hooks/`. Any surviving reference is a bug.
- [ ] **4.9 `pnpm typecheck` + `pnpm build`** must pass. `/ax:verify-ui` must pass — this phase is higher-risk since it touches every data-fetch path.
- [ ] **4.10 Commit**: `refactor(api-client): extract @ascend/api-client, dedup fetchJson across hooks`.

---

## Phase 5: `packages/storage` + `packages/ui-tokens` + CLAUDE.md rules (Day 5)

### packages/storage

- [ ] **5.1 Create `packages/storage/`:** `package.json` (name `@ascend/storage`), `src/adapter.ts`, `src/web.ts`.
- [ ] **5.2 Define `StorageAdapter` interface:**
  ```ts
  export interface StorageAdapter {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
  }
  ```
- [ ] **5.3 Implement `webStorageAdapter`** in `src/web.ts` using `localStorage`. Serialize/deserialize JSON. Silently noop on server-side render.
- [ ] **5.4 Add `@ascend/storage`** as a workspace dep in `apps/web`.
- [ ] **5.5 Update `apps/web/lib/stores/ui-store.ts`** — the Zustand `persist` middleware currently uses localStorage directly. Swap to a custom storage object that wraps `webStorageAdapter`. Keep the same storage key and version so no state is lost on reload.
- [ ] **5.6 Manual verification:** open app, set filters and view preferences, reload, confirm state persists. Clear localStorage, reload, confirm defaults restore.

### packages/ui-tokens

- [ ] **5.7 Create `packages/ui-tokens/`:** `package.json` (name `@ascend/ui-tokens`), `src/colors.ts`, `src/spacing.ts`, `src/typography.ts`, `src/radii.ts`, `src/index.ts`.
- [ ] **5.8 Export raw tokens** (plain TS objects, no Tailwind, no React). Mirror whatever lives today in `apps/web/tailwind.config.ts` and `apps/web/app/globals.css` CSS variables. For colors, encode the DS3 palette + semantic tokens.
- [ ] **5.9 Update `apps/web/tailwind.config.ts`** to `import { colors, spacing, ... } from "@ascend/ui-tokens"` and plug into the `theme.extend`. Visually identical output — verify by diffing `app/globals.css` output before/after.
- [ ] **5.10 Run `ax:verify-ui`** and visually inspect dashboard, calendar, context editor. Colors/spacing must be pixel-identical.

### CLAUDE.md cross-platform rules

- [ ] **5.11 Add a new section to `/Users/Shared/Domain/Code/Personal/ascend/CLAUDE.md`:** "Cross-Platform Rules (Wave 0+)":
  - What may live in `packages/*` (pure TS, Zod, date-fns, platform-agnostic logic).
  - What may NOT live in `packages/*` (`next/*`, `react-native`, `react-dom`, Tailwind classNames, shadcn components, `localStorage` direct access).
  - What may live in `apps/web/*` (any web lib).
  - Route handlers belong in `apps/web/app/api/`, never in packages.
  - Zustand store uses `@ascend/storage` adapter, never `localStorage` directly.
  - `fetchJson` / direct `fetch` calls are banned in `apps/web/lib/hooks/` — use `@ascend/api-client`.
  - Any new shared type lives in `@ascend/core`; any new client-server contract lives in `@ascend/api-client`.
- [ ] **5.12 Commit**: `chore(platform): add storage adapter, ui-tokens, cross-platform rules`.

---

## Phase 6: Token auth (Days 6–7)

### Decision spike

- [x] **6.1 Write 1-page decision doc at `.ascendflow/features/context-v2/wave-0-platform-foundation/AUTH-SPIKE.md`:** evaluate Better-Auth vs NextAuth v5 + custom JWT refresh on these criteria: ease of integration with Next.js 16 App Router, support for httpOnly cookies + refresh token rotation + reuse detection, support for React Native / Expo (must handle Bearer tokens from native clients in W6), community + docs, license.
- [x] **6.2 Pick one. Commit decision doc.** — Neither library chosen; custom auth service selected. Closed at `8782bfc`.

### Implementation (per AUTH-SPIKE verdict: custom auth service; detailed plan at `.ascendflow/features/wave-0-phase-6-auth/`)

- [x] **6.3 Add `authService` at `apps/web/lib/services/auth-service.ts`:** methods `createSession`, `rotateSession`, `revokeSession`, `revokeFamily`, `verifyAccessToken`, `hashRefreshToken`, plus `hashPassword`/`verifyPassword` (scrypt), `signAccessToken` (jose/HS256), `checkLoginRateLimit`, cookie builders, `runDummyScryptForTimingSafety`. Uses Prisma `Session` model.
- [x] **6.4 Add password column to `User`:** migration `20260422101222_add_user_password` adds `passwordHash String?` (nullable). `email @unique` was already present (no change needed).
- [x] **6.5 Add Zod schemas to `@ascend/core`:** `loginSchema`, `registerSchema`, `refreshSchema`.
- [x] **6.6 Implement `POST /api/auth/login`:** Parse body with `loginSchema`, scrypt-verify password (not bcrypt per AUTH-SPIKE), create session, set cookies, return user. Also: rate limit + timing-safe dummy scrypt on unknown email.
- [x] **6.7 Implement `POST /api/auth/refresh`:** cookie-only; rotates via `authService.rotateSession`; 401 on reuse (family revoked).
- [x] **6.8 Implement `POST /api/auth/logout`:** idempotent; clears cookies regardless of session state.
- [x] **6.9 Upgrade `apps/web/lib/auth.ts`:** `authenticate(request)` with THREE auth paths (per AUTH-SPIKE Wave 6 Bearer disambiguation): (1) `access_token` cookie JWT, (2) `Authorization: Bearer` JWT verify, (3) `Authorization: Bearer` API key fallback. `validateApiKey` stays as backward-compat alias.
- [x] **6.10 Confirm MCP endpoint still works with API key:** verified in ax:verify-ui R10 — 38 tools returned via `/api/mcp` with `Authorization: Bearer ascend-dev-key-change-me`.
- [x] **6.11 Add a minimal login page at `apps/web/app/(auth)/login/page.tsx`** — server component wrapping `LoginForm` in Suspense (Next.js 16 requirement for `useSearchParams`). Accessible form: labels, role="alert" error, autoComplete, disabled-during-submit, autoFocus.
- [x] **6.12 Update middleware** (`apps/web/middleware.ts`): edge-safe `jose.jwtVerify` on `access_token` cookie. Redirects unauthenticated HTML page requests to `/login?redirect=<path>`. Excludes `/api/*`, `/_next/*`, `/login`, static assets.
- [x] **6.13 Manual test:** covered by ax:verify-ui 10-scenario Phase 6 plan — R1 through R10 all PASS (`.ascendflow/verification/2026-04-22-wave0-phase6-auth-verification.md`).
- [x] **6.14 `ax:verify-ui` + `ax:review`** full pass. Three BLOCKING `ascend-security` checkpoints PASSED. `ascend-reviewer` PASS WITH NOTES (4 non-blocking). `ax:verify-ui` 10/10 scenarios PASS.
- [x] **6.15 Commit**: `feat(auth): token-based auth with JWT access + rotating refresh tokens`.

Scope expansions beyond the original spec, all tracked in `.ascendflow/features/wave-0-phase-6-auth/PRD.md`:
- Added `GET /api/auth/me` (needed by web client to render auth state on mount).
- Added `apps/web/scripts/set-password.ts` CLI seed script (self-serve password-set route would be a takeover vector on NULL `passwordHash` rows).
- Added `SessionExpiredListener` component in `(app)/layout.tsx` to clear React Query cache on `ascend:session-expired` event.
- Rewrote `apps/web/lib/api-client.ts` to drop `NEXT_PUBLIC_API_KEY` from browser auth headers and add deduplicated 401 refresh-and-retry interceptor.
- Migrated 3 bare-fetch call sites (use-dashboard.ts, export-section.tsx, onboarding-mcp-guide.tsx) to use `credentials: "include"` cookies instead of `Authorization: Bearer <API_KEY>`.
- Fixed a pre-existing scrypt bug at implementation time: Node's default scrypt maxmem (32 MiB) is too low for our params (N=2^17, r=8 needs 128 MiB). Added `SCRYPT_MAXMEM = 256 MiB` constant and passed to all three scrypt call sites. Without this, every login/password-hash would have thrown "memory limit exceeded" in production.

---

## Phase 7: Presigned-URL file upload scaffolding (Day 8)

- [ ] **7.1 Choose R2 (Cloudflare) as initial backend.** Create bucket `ascend-files-dev` in Cloudflare dashboard. Generate S3-compatible access key + secret.
- [ ] **7.2 Add env vars:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`. Document in `.env.example`.
- [ ] **7.3 Install AWS SDK v3:** `pnpm --filter @ascend/web add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.
- [ ] **7.4 Create `fileService` at `apps/web/lib/services/file-service.ts`:**
  - `createPresignedUpload(userId, { filename, mimeType, sizeBytes })` → creates PENDING `File` row, returns `{ fileId, uploadUrl, storageKey, expiresAt }`. Uploads limited to 100MB and an allowed MIME set.
  - `confirmUpload(userId, fileId, sha256)` → updates status to UPLOADED.
  - `getFile(userId, id)` (for later waves).
  - `deleteFile(userId, id)` (for later waves).
- [ ] **7.5 Add Zod schemas:** `presignUploadSchema`, `confirmUploadSchema` to `@ascend/core`.
- [ ] **7.6 Create `POST /api/files/presign`** following the api-route-patterns.md template (auth → parse → service → respond).
- [ ] **7.7 Create `POST /api/files/confirm`** similarly.
- [ ] **7.8 Manual test:** `curl` presign → get upload URL → `curl -X PUT --upload-file test.pdf "$URL"` → `curl` confirm → verify File row status=UPLOADED via Prisma Studio.
- [ ] **7.9 `ax:review`** full pass on the new service + routes.
- [ ] **7.10 Commit**: `feat(files): presigned-URL upload scaffolding with R2`.

---

## Phase 8: Lexical viability spike (Day 9)

Goal: spend ONE day validating Lexical can hit Wave 3's quality bar on web AND React Native before committing the plan.

- [ ] **8.1 Create `packages/editor-spike/`** (delete at end of spike; NOT a permanent package).
- [ ] **8.2 Install `lexical`, `@lexical/react`** in the spike.
- [ ] **8.3 Build a minimal web demo** in `apps/web/app/(app)/__spike-editor/page.tsx`:
  - Paragraph + heading + list + code + link nodes.
  - Markdown import/export.
  - Wikilink plugin that renders `[[Title]]` as a pill.
  - Slash menu for inserting blocks.
- [ ] **8.4 Build a minimal React Native demo** in a standalone Expo sandbox project (not committed to the repo — local spike). Repeat 8.3 features on native.
- [ ] **8.5 Evaluate:** does serialization produce the same JSON on both platforms? Can plugins be shared? Is performance acceptable on mobile (1000-node doc, <100ms render)?
- [ ] **8.6 Write `LEXICAL-SPIKE.md` at `.ascendflow/features/context-v2/wave-0-platform-foundation/LEXICAL-SPIKE.md`:**
  - Go / no-go decision.
  - Evidence (screenshots, perf numbers, code samples).
  - If no-go: candidate alternatives (Tiptap web-only + custom mobile, ProseMirror, Remirror, build-our-own block model).
- [ ] **8.7 Delete the `__spike-editor` route and `packages/editor-spike/`.** Keep only the spike doc.
- [ ] **8.8 Commit**: `docs(spike): Lexical viability evaluation for W3 block editor`.

---

## Phase 9: Full verification + close Wave 0 (Day 10)

- [ ] **9.1 Run `pnpm typecheck`** at root — zero errors anywhere.
- [ ] **9.2 Run `pnpm --filter @ascend/web build`** — zero errors, bundle size within 5% of pre-migration.
- [ ] **9.3 Run full `/ax:verify-ui`** via `ascend-ui-verifier`. All 111 scenarios PASS or PASS WITH NOTES with zero blocking.
- [ ] **9.4 Run `/ax:review`** via `ascend-reviewer`. Zero safety rule violations. Specifically verify:
  - No Prisma imports outside services.
  - Every service query has userId.
  - Every POST/PUT/PATCH route parses with Zod.
  - No direct `fetch` in `apps/web/lib/hooks/`.
  - No direct `localStorage` outside `@ascend/storage`.
  - MCP tools unchanged in behavior.
- [ ] **9.5 Run `/ax:deploy-check`.** Confirms build, types, migration safety, env vars, rule compliance.
- [ ] **9.6 Manual smoke test in Dia browser:**
  - Log in, navigate to dashboard, calendar, context, todos, goals.
  - Create a todo via quick-add.
  - Complete a todo.
  - Edit a context entry.
  - Reload page — filters persist.
  - Log out.
- [ ] **9.7 Manual MCP test:**
  - Call `get_dashboard`, `list_goals`, `search_context`, `create_todo`, `get_daily_big3` via the MCP endpoint with an API key.
  - All 5 return the expected shape.
- [ ] **9.8 Update `CLAUDE.md`** project section to reflect monorepo reality: paths in the Key File Lookup table now prefixed with `apps/web/`. Add `@ascend/core`, `@ascend/api-client`, `@ascend/storage`, `@ascend/ui-tokens` to architecture section.
- [ ] **9.9 Update `.ascendflow/BACKLOG.md`:** remove `fetchJson duplicated` danger zone (resolved in Wave 0). Retain note that Wave 0 shipped.
- [ ] **9.10 Write close-out note at `.ascendflow/features/context-v2/wave-0-platform-foundation/CLOSE-OUT.md`:** summary of what shipped, deliverables checklist status (DONE / SKIPPED / NOT DONE per PRD), any deferred work moved to W1 or backlog, any scope changes, final size in days vs estimate.
- [ ] **9.11 Commit**: `chore(wave-0): close Wave 0 — platform foundation shipped`.
- [ ] **9.12 Present deliverables checklist to user.** Explicitly mark each PRD success criterion as DONE / SKIPPED / NOT DONE. Use `"Partially complete"` if any are NOT DONE. Only then may Wave 0 be called complete.

---

## Post-Wave 0 handoff to Wave 1

Once Phase 9 closes with all criteria DONE:

1. Start Wave 1 (graph foundation) with the PRD in `.ascendflow/features/context-v2/wave-1-graph-foundation/PRD.md`.
2. W1 can assume: monorepo live, `@ascend/core` exists, `@ascend/api-client` is the only client, `File`/`Session` models deployed, token auth working, cross-platform rules in CLAUDE.md.
3. If any W0 deliverable is SKIPPED / NOT DONE, W1 absorbs the remaining work before it can proceed.
