# Wave 0: Platform Foundation

**Slug:** `context-v2` / `wave-0-platform-foundation`
**Created:** 18. 4. 2026
**Status:** planning
**Parent vision:** [.ascendflow/features/context-v2/VISION.md](../VISION.md)
**Wave sizing:** ~1–2 weeks solo (target: 10 working days)

## Problem

Context v2 is a 10-wave journey that ends with a universal, AI-first context layer shippable to web + iOS + Android + macOS + Windows. The current Ascend codebase is a single Next.js app. Waves 1 through 10 each require pieces that do not exist yet:

- **Shared types and schemas** that a web app, a native app, and a desktop shell can all import (today they live in `lib/validations.ts` inside the web app and are not portable).
- **A single API client** with one auth pattern (today the `fetchJson` helper is duplicated across 5 hook files — flagged as a danger zone in `CLAUDE.md`).
- **A storage adapter** that abstracts localStorage so the same Zustand store can use SecureStore on iOS/Android and the filesystem on desktop.
- **Token-based auth** so mobile and desktop clients can log in (the current API-key-in-header pattern is fine for MCP clients but unacceptable as the only option for native).
- **Presigned-URL file upload infrastructure** because Wave 4 (universal files) and Wave 6 (multi-modal capture) will need it, and Wave 2 AI workflows will already want to store audio blobs.
- **Cross-platform rules in CLAUDE.md** so every later wave is implemented with platform-portability in mind.

Attempting Wave 1 without this foundation is cheap today but ~40% more expensive for every subsequent wave. By Wave 5 the cost of retrofitting the monorepo, extracting packages, and migrating auth becomes a rewrite rather than a refactor. Wave 0 pays that cost upfront, once, with **zero user-visible regressions**.

## User Story

As the developer of Ascend, I want the platform to be structured as a monorepo with shared packages, token-based auth, and storage abstraction so that every later wave can ship web, native, and desktop surfaces without architectural rewrites.

End users see **no visible change** in Wave 0. The existing Ascend web app must behave identically.

## Success Criteria

Functional parity:
- [ ] All 111 existing `ax:verify-ui` scenarios pass on the migrated codebase (PASS or PASS WITH NOTES, zero blocking scenarios).
- [ ] `npm run build` / `pnpm run build` passes in the monorepo root and in `apps/web`.
- [ ] `npx tsc --noEmit` passes across the entire monorepo.
- [ ] All 37 MCP tools continue to respond correctly at `/api/mcp`.
- [ ] Existing API key auth continues to work for MCP clients.

New capabilities (infrastructural, not yet user-visible):
- [ ] Monorepo with pnpm workspaces. Current code lives at `apps/web/`.
- [ ] `packages/core` exports Zod schemas, types, enums, constants. `apps/web` consumes them.
- [ ] `packages/api-client` exports a single `apiClient` wrapper. All 5 duplicated `fetchJson` copies in hooks are removed.
- [ ] `packages/ui-tokens` exports colors, spacing, typography, radii as raw tokens (no Tailwind dependency in the package itself).
- [ ] `packages/storage` exports a `StorageAdapter` interface plus a `webStorageAdapter` using localStorage. `lib/stores/ui-store.ts` uses it.
- [ ] Token auth endpoints exist: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`. The web app uses JWT access + refresh tokens stored in httpOnly cookies.
- [ ] API key auth continues to work in parallel for MCP clients (both paths supported by `validateApiKey` → rename to `authenticate`).
- [ ] Presigned-URL file upload scaffolding: `POST /api/files/presign` returns a presigned S3/R2 upload URL. A `files` table exists in Prisma. No UI consumes it yet — infrastructure only.
- [ ] CLAUDE.md updated with a new `Cross-Platform Rules` section documenting the import boundaries and what code may live where.
- [ ] Lexical viability spike complete: a 1-day standalone prototype confirms Lexical can render on web and React Native with sufficient quality; spike notes committed to `.ascendflow/features/context-v2/wave-0-platform-foundation/LEXICAL-SPIKE.md`.

Quality bar:
- [ ] No new direct imports of `@/lib/db` or `@prisma/client` outside `apps/web/lib/services/` (or wherever services end up post-migration).
- [ ] No regression in production build size >5% (web app bundle).
- [ ] No regression in dev server cold-start time >20%.
- [ ] Full `ax:review` pass with zero safety rule violations.

## Affected Layers

- **Repository structure**: root becomes monorepo. Current code moves to `apps/web/`.
- **Prisma schema**: add `File` model and `Session` model (for refresh tokens). No destructive changes to existing tables.
- **Service layer**: `authService`, `fileService` added. Existing services moved under `apps/web/lib/services/` (or shared via a `packages/services` if the Lexical spike or W1 planning reveals they should be shared — decided during Wave 0 execution, not here).
- **API routes**: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/files/presign` added. All other routes migrated under `apps/web/app/api/`.
- **React Query hooks**: the duplicated `fetchJson` helper is removed from `use-goals.ts`, `use-todos.ts`, `use-context.ts`, `use-categories.ts`, `use-dashboard.ts`. All import from `@ascend/api-client`.
- **UI components**: no visible changes. Tailwind config updated to consume tokens from `@ascend/ui-tokens`.
- **MCP tools**: zero changes to tool surface. `authenticate()` handles both API key and JWT.
- **Zustand store**: `ui-store.ts` uses `storageAdapter.get/set` instead of direct `localStorage` calls.
- **New packages**: `packages/core`, `packages/api-client`, `packages/ui-tokens`, `packages/storage`.
- **Build system**: pnpm workspaces, optional Turborepo for caching. CI/CD updated to use pnpm.

## Data Model Changes

Two new models in `prisma/schema.prisma`. Additive only — no destructive changes to existing tables.

```prisma
model File {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Storage
  storageKey String   // S3/R2 key, e.g., "users/<userId>/<uuid>.pdf"
  bucket     String   @default("ascend-files")
  mimeType   String
  sizeBytes  BigInt

  // Identity
  filename   String
  sha256     String?  // Content hash for deduplication (v1+)

  // Lifecycle
  uploadedAt DateTime?
  status     FileStatus @default(PENDING)  // PENDING, UPLOADED, FAILED

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([userId, status])
  @@index([sha256])
}

enum FileStatus {
  PENDING
  UPLOADED
  FAILED
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Refresh token family (for rotation + reuse detection)
  familyId     String
  refreshTokenHash String  @unique  // SHA-256 of current refresh token
  expiresAt    DateTime
  revokedAt    DateTime?

  // Client metadata
  userAgent    String?
  ipAddress    String?
  deviceName   String?

  createdAt    DateTime @default(now())
  lastUsedAt   DateTime @default(now())

  @@index([userId])
  @@index([familyId])
}
```

Migration name: `20260418_wave0_platform_foundation`.

**No `db push`. No `migrate reset`.** The existing `search_vector` tsvector column on `ContextEntry` is invisible to Prisma and must survive this migration (safety rule 6 in `CLAUDE.md`).

## API Contract

### Auth endpoints

`POST /api/auth/login`
- **Body:** `{ email: string, password: string }` (v1 uses password; future waves add OAuth providers)
- **200:** `{ user: { id, email, name } }`. Sets `access_token` (15 min) + `refresh_token` (30 days, rotated per use) as httpOnly Secure cookies.
- **401:** invalid credentials.

`POST /api/auth/refresh`
- **Body:** none (refresh token read from httpOnly cookie).
- **200:** new `access_token` + rotated `refresh_token` cookies.
- **401:** refresh token invalid, expired, or reuse detected → revokes entire family.

`POST /api/auth/logout`
- **200:** revokes current refresh token family, clears cookies.

### File upload endpoint

`POST /api/files/presign`
- **Body:** `{ filename: string, mimeType: string, sizeBytes: number }` (Zod-validated)
- **200:** `{ fileId: string, uploadUrl: string, storageKey: string, expiresAt: string }`. Creates `File` row with `status: PENDING`.
- **400:** size >100MB or disallowed MIME type.

`POST /api/files/confirm`
- **Body:** `{ fileId: string, sha256: string }`
- **200:** updates `File.status` to `UPLOADED`, records `uploadedAt` and `sha256`.
- **404:** file not found or not owned by user.

Client flow: client calls `/presign` → uploads blob directly to R2 with returned URL → calls `/confirm` with computed SHA-256.

### Unchanged

All 50+ existing API routes under `/api/*` are unchanged in contract. They're moved from `app/api/` to `apps/web/app/api/` and their service imports are rewritten to use `@/lib/services/*` (relative to `apps/web`) or `@ascend/core` for shared types.

MCP endpoint at `/api/mcp` is unchanged. The 37 tools continue to be served by the same server.

## UI Flows

**None.** Wave 0 is infrastructural. No new UI. No visible changes to the existing UI.

The only user-observable behaviors that might shift:
- Reload time might change by a few hundred ms.
- localStorage keys might be re-namespaced (migration handled in Zustand `version` field).

## Cache Invalidation

N/A for Wave 0. No new mutations that touch existing domains.

## Danger Zones Touched

**fetchJson duplicated** (existing danger zone from `CLAUDE.md`): Wave 0 resolves this. All 5 copies collapse into `@ascend/api-client`. **How handled:** extract once, delete all copies in the same PR that introduces the package. Verification via Grep for `fetchJson` returning only the new package definition.

**Prisma migration discipline**: adding `File` and `Session` with `prisma migrate dev --name wave0_platform_foundation`. **How handled:** review the generated SQL before applying; confirm it only adds tables (no ALTERs on existing tables); keep `search_vector` untouched.

**Zustand localStorage persistence**: `useUIStore` currently writes directly to localStorage with a version key. Switching to `storageAdapter` risks wiping persisted UI state on first load. **How handled:** the web adapter uses the identical localStorage key and format; no migration needed. Tested manually by reloading the app and confirming filter/sort/view state persist.

**Monorepo conversion**: moving `app/`, `components/`, `lib/`, `prisma/` under `apps/web/` changes thousands of relative imports if done wrong. **How handled:** keep `@/` path alias working (absolute imports survive); rewrite `tsconfig.json` paths; use `pnpm dlx @sindresorhus/is` or a codemod to rewrite relative imports only if needed. Likely minimal touch if `@/` is consistent throughout the codebase (verified pre-migration).

**Route handler contract**: Next.js 16 App Router routes must stay in the same URL paths after the move. **How handled:** the move is purely filesystem (`app/` → `apps/web/app/`); Next detects routes from the app directory it's launched against, so `next dev --dir apps/web` keeps the same routes.

## Cross-Platform Readiness

This is the wave where cross-platform gets locked in. Every decision here determines what is possible in W6 (mobile) and W9+ (desktop).

**Packages MUST be platform-agnostic:**
- `packages/core`: no `react`, no `next`, no `react-native`. Only pure TS, Zod, date-fns.
- `packages/api-client`: uses `fetch` (polyfilled on native later). No `next/*` imports.
- `packages/ui-tokens`: raw token exports (colors, spacing, typography). No Tailwind. No React.
- `packages/storage`: interface + platform implementations. Web impl uses localStorage. Native impl in W6 will use AsyncStorage + SecureStore.

**Apps MAY be platform-specific:**
- `apps/web` (today): Next.js, React, Tailwind, shadcn/ui — free to use any web library.
- `apps/mobile` (W6): Expo, React Native, NativeWind.
- `apps/desktop` (W9+): Tauri shell wrapping `apps/web` or a separate client.

**CLAUDE.md cross-platform rules** added in Wave 0 codify this. See Task 9.

## Out of Scope

- **Anthropic provider, OpenAI integration, embeddings, RAG** — Wave 2.
- **Typed links / graph view / entry types** — Wave 1.
- **Block editor / Lexical integration** — Wave 3 (spike only in Wave 0).
- **File UI (drag-and-drop, attachment list)** — Wave 4.
- **Mobile app setup (`apps/mobile`)** — Wave 6.
- **Desktop app (`apps/desktop`)** — Wave 9+.
- **Workspace / multi-tenancy** (`workspaceId` populated) — Wave 8. In Wave 0, `workspaceId` may be added to key tables as nullable if schema-adjacent, otherwise deferred.
- **Migrating to Better-Auth vs NextAuth** — decision made during Wave 0 spike. Whichever is chosen is the only one implemented. No side-by-side.
- **Rate limiting, audit logs, MFA** — Wave 8 (enterprise hardening).

## Open Questions

1. **Better-Auth vs NextAuth+JWT+refresh:** Better-Auth is newer, simpler, opinionated toward web+native. NextAuth (v5) has deeper Next.js integration but JWT-refresh requires custom code. Resolved during Task 5 spike.
2. **Turborepo or pnpm workspaces alone:** pnpm workspaces are sufficient for 4 packages + 1 app. Turborepo adds caching but is another config surface. Start without Turborepo; add when build times warrant.
3. **R2 vs S3 vs Backblaze B2 for blob storage:** all S3-compatible via the AWS SDK. R2 has no egress fees (best for serving file previews). Decision: R2 for Wave 0; adapter pattern allows swap.
4. **Should `workspaceId` be added to entity tables now (as nullable) or in W8:** adding now (nullable, unused) avoids a destructive backfill in W8. Decision deferred to Task 2 (schema review).

## Verification Plan

- [ ] `npx tsc --noEmit` at root AND `apps/web` — zero errors.
- [ ] `pnpm run build` at root AND `apps/web` — zero errors.
- [ ] `pnpm run dev` at root — web app starts and serves at localhost:3000.
- [ ] `ax:verify-ui` — full suite passes. Sample: calendar, context editor, todo completion, goal creation, filter persistence across reload, sidebar category tree.
- [ ] `ax:review` — zero safety rule violations.
- [ ] `ax:test` — `tsc --noEmit` + `next build` green.
- [ ] Manual MCP smoke test: call 5 tools (list_goals, create_todo, get_dashboard, search_context, set_daily_big3) via the MCP endpoint with existing API key; responses match pre-migration shape.
- [ ] Manual auth flow test: log out → log in with email/password → verify access token in cookie → wait 15 min or force refresh → verify refresh succeeds → log out → verify refresh token revoked.
- [ ] Manual presigned upload test: `curl` the `/api/files/presign` endpoint → upload a file to the returned URL → `curl` `/confirm` → verify `File` row in Prisma Studio.
- [ ] Lexical spike output: `LEXICAL-SPIKE.md` committed with go/no-go decision and evidence.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Monorepo move breaks imports/routes | Medium | High | Preserve `@/` alias; test `next dev` immediately after move; run full `ax:verify-ui` before merging. |
| Token auth migration locks out the user | Low | Critical | Retain API key auth path in parallel until JWT proven. User has MCP client running which uses API keys — must not break. |
| Lexical spike reveals W3 is infeasible | Medium | Medium | Wave 0 still succeeds on its own. Fall back: keep existing `ContextEntryEditor` in W3 and adopt a different editor (Remirror? Custom?). Vision adjusts but W0 is not blocked. |
| `fetchJson` consolidation introduces a cache-key regression | Low | High | Each hook file migrated in its own commit; after each, run `ax:verify-ui` on that domain. |
| Presigned URL infra requires R2 account not yet created | Low | Low | Create R2 bucket before Task 7; credentials go in `.env.local` and Vercel/Dokploy env. |
| Time overrun: monorepo conversion is more fiddly than expected | Medium | Medium | Timebox to 4 days. If not done, split Wave 0 into W0a (monorepo + packages + CLAUDE.md) and W0b (auth + files + spike). Ship W0a alone. |

## Size Estimate

**Target: 10 working days solo.**

- Days 1–2: Monorepo conversion + package scaffolding.
- Days 3–4: `packages/api-client` + `fetchJson` dedup.
- Day 5: `packages/ui-tokens` + `packages/storage` + CLAUDE.md rules.
- Days 6–7: Token auth (spike + implementation).
- Day 8: Presigned URL scaffolding.
- Day 9: Lexical viability spike.
- Day 10: Full `ax:verify-ui` + `ax:review` + fixes + buffer.

If blocked mid-wave, split as noted in Risks table.

## Handoff to Wave 1

When Wave 0 closes, Wave 1 (graph foundation) can start immediately. Wave 1 requires:
- `packages/core` to hold the `ContextEntryType` enum and `ContextLink` types.
- `packages/api-client` to handle the new MCP routes and REST routes for graph.
- `apps/web/` to remain the only client (mobile starts in W6).

No Wave 1 change is blocked by Wave 0 beyond these prerequisites.
