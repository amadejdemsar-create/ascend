# Wave 0 Phase 6: Token Auth (JWT + Rotating Refresh)

**Slug:** `wave-0-phase-6-auth`
**Created:** 22. 4. 2026
**Status:** planning
**Parent wave:** [.ascendflow/features/context-v2/wave-0-platform-foundation/PRD.md](../context-v2/wave-0-platform-foundation/PRD.md)
**Spike:** [.ascendflow/features/context-v2/wave-0-platform-foundation/AUTH-SPIKE.md](../context-v2/wave-0-platform-foundation/AUTH-SPIKE.md) (committed `8782bfc`)
**Estimated size:** ~2 working days solo (Days 6 and 7 of Wave 0)

## Problem

Ascend currently authenticates every API request by matching an `Authorization: Bearer <apiKey>` header against `User.apiKey`. The apiKey is provisioned at user creation and effectively acts as a permanent session. This works for the 37 MCP tools that call `/api/mcp` from Claude Desktop, and it works for the web app because `apps/web/lib/api-client.ts` currently injects `NEXT_PUBLIC_API_KEY` into every fetch, but it is unacceptable as the only auth path for three reasons:

1. **Web UX.** There is no login flow. The web app trusts whatever environment has the API key baked into the bundle. A visitor without the env var sees the app break instead of being redirected to login.
2. **Token rotation / reuse detection.** A long-lived bearer is high-blast-radius if it leaks. The Phase 3 `Session` model (`familyId`, `refreshTokenHash`, `revokedAt`) was added specifically so Phase 6 can issue short-lived access tokens + rotating refresh tokens with automatic family revocation on reuse.
3. **Wave 6 (Expo).** The native client needs Bearer auth on the same API routes. Cookies are impractical on React Native (cross-origin, SecureStore management). The plan is: native sends `Authorization: Bearer <accessTokenJWT>`, the backend's `authenticate()` function tries JWT verification first and falls back to API key lookup. Without a JWT layer, there is nothing for Wave 6 to send.

The AUTH-SPIKE settled the library question (custom auth service, not Better-Auth or NextAuth v5) and two design questions (scrypt for password hashing with parameters `N=2^17, r=8, p=1, salt 16B, key 64B`; JWT-first disambiguation in `authenticate()`). What remains is the concrete implementation plan: service, routes, middleware, cookies, claim shapes, test plan, rate limiting posture, seed-user path.

## User Story

As the developer-and-sole-user of Ascend, I want to log in with an email and password, have my browser session refreshed automatically every 15 minutes, and have the MCP integration continue to work unchanged, so that the web app has proper auth UX and the mobile app (Wave 6) has a Bearer token contract to target.

End users (in Wave 0 that means me plus any future single-tenant deployments) see ONE visible change: unauthenticated visits to `/` are redirected to `/login`, and there is a minimal login form at `/login`. All other surfaces are identical.

## Success Criteria

Functional parity:

- [ ] All 37 MCP tools at `/api/mcp` continue to work with the existing `Authorization: Bearer <apiKey>` header. Tested via `curl` at minimum for `get_dashboard`, `list_goals`, `search_context`, `create_todo`, `get_daily_big3`.
- [ ] All existing API routes at `/api/goals`, `/api/todos`, `/api/context`, `/api/categories`, `/api/dashboard`, etc. continue to work with both auth paths (cookie OR API key). No route contract changes.
- [ ] All 111 `ax:verify-ui` scenarios pass with the web app using cookie auth instead of `NEXT_PUBLIC_API_KEY` in the bundle.

New capabilities:

- [ ] `POST /api/auth/login` accepts `{ email, password }`, verifies via scrypt, issues access + refresh cookies, returns `{ user: { id, email, name } }` on 200, `{ error }` on 401.
- [ ] `POST /api/auth/refresh` rotates the refresh token on every call, revokes the entire family on reuse detection, returns 401 and clears cookies on failure.
- [ ] `POST /api/auth/logout` revokes the current refresh token and clears cookies.
- [ ] `GET /api/auth/me` returns the current user (fed by cookie OR API key) so the web app can render auth state on page load.
- [ ] `authenticate(request)` in `apps/web/lib/auth.ts` resolves a user from any of three sources in priority order: cookie access token, Bearer header JWT, Bearer header API key. `validateApiKey` stays exported as a thin alias for backward compatibility.
- [ ] `apps/web/middleware.ts` redirects unauthenticated `/` (and other protected app paths) to `/login?redirect=<path>`.
- [ ] `apps/web/app/(auth)/login/page.tsx` renders a minimal login form: email + password + submit. Posts to `/api/auth/login` via `@ascend/api-client`. Redirects to the original URL or `/` on success. No design polish (Wave 8 covers that).
- [ ] A seed CLI at `apps/web/scripts/set-password.ts` lets the developer set or reset the password for the primary user via `ASCEND_EMAIL` + `ASCEND_PASSWORD` env vars (one-shot command, not exposed as a route).
- [ ] Login rate limit: max 5 failed attempts per email per 15 minutes, enforced with an in-process Map (single-node deployment; documented limitation for multi-node).
- [ ] `apps/web/lib/api-client.ts` stops injecting `API_KEY` into the Authorization header for web-browser calls. The browser relies on cookies. The API key env var can be removed from the web bundle entirely after verification (it remains available to MCP clients; nothing in-browser depends on it).

Quality bar:

- [ ] `ascend-security` audit returns PASS at three checkpoints: (a) after schema + validation, (b) after authService + route handlers, (c) after middleware + login page + api-client migration. Any FAIL blocks the phase.
- [ ] Zero violations in `ax:review` (safety rules 1-6 plus accessibility).
- [ ] `ax:verify-ui` PASS or PASS WITH NOTES on a dedicated login + session scenario set (see Verification Plan below).
- [ ] `npx tsc --noEmit` across the monorepo: zero errors.
- [ ] `pnpm --filter @ascend/web build` succeeds; bundle size within 5% of current baseline.
- [ ] The `search_vector` tsvector column on `ContextEntry` survives the migration (safety rule 6).
- [ ] No new direct `@prisma/client` imports outside `apps/web/lib/services/`.

## Affected Layers

- **Prisma schema** (`apps/web/prisma/schema.prisma`): add `passwordHash String?` to the `User` model. No new models (the `Session` model was added in Phase 3). No changes to any other table.
- **Migration**: `20260422_add_user_password` (migration name stable; file name will be generated by `prisma migrate dev`).
- **Service layer**: new `apps/web/lib/services/auth-service.ts` (session create/rotate/revoke, JWT sign/verify, scrypt password hash/verify, rate limit tracker). Existing `apps/web/lib/services/user-service.ts` gains `findByEmail(email)` and `setPassword(userId, hash)` methods.
- **Shared schemas**: `packages/core/src/schemas/auth.ts` (new) exports `loginSchema`, `registerSchema` (reserved for later), `refreshSchema` (empty body, kept for symmetry). Re-exported from `@ascend/core`.
- **API routes**: new `apps/web/app/api/auth/login/route.ts`, `apps/web/app/api/auth/refresh/route.ts`, `apps/web/app/api/auth/logout/route.ts`, `apps/web/app/api/auth/me/route.ts`.
- **Auth module**: `apps/web/lib/auth.ts` upgrades `validateApiKey` to `authenticate(request)`. Keeps `validateApiKey` as a thin alias.
- **Middleware**: new `apps/web/middleware.ts` running on every non-static request. Cookie access token presence gates protected app paths; unauthenticated hits redirect to `/login?redirect=<path>`.
- **Web HTTP client**: `apps/web/lib/api-client.ts` drops `API_KEY` injection for web calls. Adds an interceptor that, on 401, calls `/api/auth/refresh` once, retries the original request, and redirects to `/login` if refresh fails.
- **UI**: new `apps/web/app/(auth)/login/page.tsx` + `apps/web/app/(auth)/layout.tsx`. Also `apps/web/components/auth/logout-button.tsx` (small component used in the sidebar settings menu).
- **Seed/ops**: new `apps/web/scripts/set-password.ts` (tsx-runnable) that hashes `ASCEND_PASSWORD` with scrypt and updates `User.passwordHash` for the email in `ASCEND_EMAIL`.
- **Environment**: new env vars (documented in `apps/web/.env.example`): `AUTH_JWT_SECRET` (required in prod), `AUTH_REFRESH_TOKEN_PEPPER` (optional, additional entropy for refresh token hashing), `COOKIE_DOMAIN` (optional, for production cross-subdomain setups). `NEXT_PUBLIC_API_KEY` removed from web bundle after verification (kept in server-only envs for MCP tests).
- **Dependencies**: `jose` (for JWT sign/verify on Node and Edge runtimes) added to `apps/web` via `pnpm --filter @ascend/web add jose`. No other new deps.
- **Zustand store, React Query hooks, MCP tools**: no changes. The service layer is the auth boundary.

## Data Model Changes

Single additive field on `User`. No other schema changes.

```prisma
model User {
  // ... existing fields unchanged
  passwordHash String?  // nullable for the seed user before set-password runs, and for users auth'd via external providers in the future
  // ... relations unchanged
}
```

Migration name: `add_user_password`. Generated file will be `apps/web/prisma/migrations/<timestamp>_add_user_password/migration.sql`. The generated SQL must be reviewed by `ascend-migration-auditor` before apply. Expected content: single `ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;` (nullable, no default). Anything else is a red flag.

`search_vector` verification: the auditor must confirm the migration does not drop or alter the tsvector column on `ContextEntry`. Run a quick grep of the migration SQL for `search_vector` — should return nothing.

## API Contract

### `POST /api/auth/login`

**Auth:** none required.
**Body:** validated by `loginSchema` in `@ascend/core`.
```json
{ "email": "user@example.com", "password": "plaintext" }
```
**200:** sets `access_token` and `refresh_token` cookies, returns user shape.
```json
{ "user": { "id": "cuid", "email": "user@example.com", "name": "Display Name" } }
```
**401:** invalid credentials or rate-limited. Body: `{ "error": "Invalid credentials" }` (same message for unknown email and wrong password, to prevent enumeration).
**429:** too many failed attempts (5+ in 15 minutes for this email). Body: `{ "error": "Too many attempts. Try again later." }` with `Retry-After` header.

### `POST /api/auth/refresh`

**Auth:** cookie-based. Reads `refresh_token` cookie.
**Body:** none (empty object accepted for client symmetry).
**200:** rotates `refresh_token`, issues new `access_token`, both as cookies. Body: `{}`.
**401:** invalid, expired, or reuse-detected refresh token. Revokes family if reuse detected. Clears cookies. Body: `{ "error": "Session expired" }`.

### `POST /api/auth/logout`

**Auth:** cookie-based (but tolerant: missing or invalid cookies still return 200 with cleared cookies, so a stale logout is idempotent).
**Body:** none.
**200:** revokes current refresh token, clears cookies. Body: `{}`.

### `GET /api/auth/me`

**Auth:** required via any path (cookie OR Bearer JWT OR Bearer API key).
**200:** `{ "user": { "id", "email", "name" } }`.
**401:** not authenticated. Body: `{ "error": "Unauthorized" }`.

### Unchanged contracts

All 50+ existing `/api/*` routes keep their current shapes. The only change is internal: they now call `authenticate(request)` instead of `validateApiKey(request)`. `validateApiKey` is still exported as a tombstone alias pointing at `authenticate` so old imports continue to type-check.

The MCP endpoint at `/api/mcp` is completely unchanged. The factory still receives `userId` from `authenticate()`, which resolves the API key path identically to the pre-Phase-6 `validateApiKey`.

## JWT Claim Shape

Access token (JWT, 15-minute expiry):

```json
{
  "sub": "<userId cuid>",
  "email": "<user.email>",
  "iat": <unix seconds>,
  "exp": <iat + 900>,
  "iss": "ascend",
  "aud": "ascend-web"
}
```

Signed with HS256 using `AUTH_JWT_SECRET` (minimum 32 bytes, enforced at startup with a clear error if missing or too short).

No refresh token claims — refresh tokens are opaque 256-bit random hex strings, stored as SHA-256 hashes in the `Session.refreshTokenHash` column. Client never sees the hash; server never stores the raw token.

Why opaque refresh instead of JWT: opaque tokens are revocable. Revoking a JWT refresh requires a denylist, which is the same DB lookup we get "for free" by storing a hashed token in `Session`.

## Cookie Shape

Both cookies:
- `httpOnly: true`
- `secure: true` (in production; `false` in dev where `NODE_ENV !== "production"`)
- `sameSite: "lax"`
- `path: "/"`
- `domain`: not set by default (host-only cookie); set to `COOKIE_DOMAIN` env if provided (for subdomain setups).

`access_token`:
- value: the JWT
- `maxAge: 900` (15 minutes)

`refresh_token`:
- value: the raw 256-bit hex refresh token (only the hash is stored server-side)
- `maxAge: 2592000` (30 days)

## Rate Limiting Posture

Threat: credential stuffing against a single user. Mitigation: in-process `Map<email, { attempts: number; resetAt: number }>` in `authService`. 5 failed attempts per email per 15-minute rolling window triggers 429 on subsequent logins until the window resets. Successful login resets the counter.

This is deliberately simple. Not Redis, not a distributed limiter, not IP-based. Single-node Ascend deployments (Dokploy) need nothing more. Multi-node or CDN-backed deployments would require Redis; documented as a known limitation at the top of `auth-service.ts` with a migration path comment.

The in-process limit also does nothing against distributed attacks (many IPs). That is acceptable for the current single-user, single-tenant deployment. When Ascend becomes multi-tenant in Wave 8, a proper limiter slots in behind the same `authService.checkLoginRateLimit(email)` interface.

## Seed User Path

The primary user already exists in the DB (seeded at first deploy). `passwordHash` is NULL. The developer runs, from the repo root:

```bash
ASCEND_EMAIL=developer@example.com \
ASCEND_PASSWORD='<chosen password>' \
pnpm --filter @ascend/web tsx scripts/set-password.ts
```

The script:
1. Validates `ASCEND_PASSWORD` is at least 12 characters.
2. Hashes with `crypto.scrypt` using the settled parameters.
3. Updates `User.passwordHash` where `email = ASCEND_EMAIL`.
4. Exits with a clear success or "user not found" message.

After running, the developer can log in via the `/login` page with those credentials.

**Not a route.** Deliberately excluded from the HTTP surface. Adding a self-serve password-set endpoint opens a takeover vector for any user whose `passwordHash` is NULL (which all pre-Phase-6 users are). The CLI is the only path.

Registration route (`POST /api/auth/register`) is reserved in `loginSchema`'s sibling `registerSchema` but is NOT implemented in Phase 6. Single-user system has no need; multi-tenant Wave 8 adds it.

## UI Flows

### Login page (`/login`)

Minimal. One card centered on the page:
- Heading: "Sign in to Ascend"
- Form: email input, password input, submit button "Sign in"
- Below the form: no signup link (not supported in Phase 6), no "forgot password" link (deferred to Wave 8)
- On submit: `POST /api/auth/login` via `@ascend/api-client`. On 200, redirect to `searchParams.get("redirect") || "/"`. On 401, show inline error "Invalid email or password." On 429, show "Too many attempts. Please wait 15 minutes."
- No design polish. Wave 8 will make this beautiful. Keep it functional.

### Redirect on unauthenticated access

Middleware intercepts any request to `/`, `/goals`, `/todos`, `/calendar`, `/context`, `/dashboard`, `/settings`, etc. (all paths inside the `(app)` route group):
- If cookie `access_token` is present AND verifies → let the request through.
- If cookie `access_token` is absent or malformed → redirect to `/login?redirect=<original path>`.
- If cookie exists but JWT is expired → let the request through; the route-handler-level `authenticate()` will fail and trigger the refresh flow on the client.

Middleware does NOT call `/api/auth/refresh` itself. That stays a client-side responsibility via the api-client interceptor, because middleware runs on every request and bloating it with refresh calls creates redirect storms.

### Logout

Small button in the sidebar settings menu or user avatar popover. Calls `POST /api/auth/logout` via `@ascend/api-client`, then `router.push("/login")` on success.

### API-client 401 interceptor

`apiFetch` in `apps/web/lib/api-client.ts` catches 401 responses:
1. If the URL is `/api/auth/*` → rethrow (do not recurse).
2. Otherwise, call `POST /api/auth/refresh` (without retry interceptor).
3. If refresh returns 200 → retry the original request once.
4. If refresh returns 401 → clear any in-memory state and `window.location = "/login?redirect=<current path>"`.

This is the single change to every fetch path. No hook files change. No component files change.

## Cache Invalidation

On logout:
- `queryClient.clear()` to drop all cached user data (GDPR-adjacent hygiene, plus avoids showing stale data if a different user logs in).

On login:
- No explicit invalidation needed. Queries run on next render and will fetch fresh.

On refresh:
- No invalidation. Refresh is transparent to data queries.

## Danger Zones Touched

**DZ-5 (fetchJson duplicated): RESOLVED in Phase 4.** No action needed. The api-client interceptor change in Phase 6 lands in the one-and-only `apps/web/lib/api-client.ts`.

**DZ-7 (no error boundaries).** The `/login` page and the (auth) layout should be wrapped in a minimal error boundary so a login form render error doesn't 500 the whole app. New risk in Phase 6; mitigated by adding a per-layout error boundary at `apps/web/app/(auth)/error.tsx` (Next.js convention).

**New danger zone: auth correctness.** Password hashing, JWT signing, cookie flag correctness, refresh rotation atomicity, reuse detection, rate limit bypass, CSRF. Every one of these is a critical failure mode. Mitigation: `ascend-security` audit is MANDATORY at the three checkpoints listed in Success Criteria, not optional, not end-only.

**Safety rule 6 (no `prisma db push`, no `migrate reset`).** The migration must be generated via `prisma migrate dev` and audited by `ascend-migration-auditor` before apply. No ad-hoc SQL.

## Platform-Agnostic Discipline (Wave 0 rules)

The shared `@ascend/core` addition (auth Zod schemas) stays pure TypeScript + Zod. No `next/*`, no React, no DOM imports.

All Next.js specifics (cookies, middleware, route handlers, `@/*` path alias) live in `apps/web`. The `authService` itself is inside `apps/web/lib/services/` (server-only, Prisma-backed) and is therefore allowed to use Node built-ins like `crypto` and `jose`.

When Wave 6 (Expo) lands, the mobile client will:
- Store the access token JWT in expo-secure-store.
- Send it as `Authorization: Bearer <jwt>` on every request.
- Refresh it via `POST /api/auth/refresh` with the refresh token sent in an `X-Refresh-Token` header (since cookies are cross-origin-unfriendly on native). **Deliberately out of scope for Phase 6** but called out so the server implementation leaves room: `authenticate()` tries JWT verification first; the refresh route is cookie-first but should be designed to accept the refresh token from `X-Refresh-Token` as a fallback path that we implement in Wave 6 (just a TODO comment, not a runtime feature, in Phase 6).

## Out of Scope

- **OAuth / social login** (Google, GitHub, Apple). Future Wave 8 or later.
- **Registration via HTTP** (`POST /api/auth/register`). Phase 6 uses the CLI seed script only.
- **Password reset via email.** Requires transactional email infra (Resend or similar); deferred to Wave 8 polish.
- **2FA / TOTP.** Wave 8 enterprise hardening.
- **Magic link sign-in.** Same as above.
- **Session list / device management UI.** The `Session` model captures device metadata, but exposing it as UI waits until Wave 8.
- **Distributed rate limiting (Redis).** Single-node in-process limiter only.
- **Mobile client JWT in `X-Refresh-Token` header flow.** Server leaves a comment TODO; full implementation in Wave 6.
- **Removing the `apiKey` column from User.** API key auth stays forever for MCP. That column is NOT deprecated; it's a first-class auth path.
- **Admin panel for user management.** Single-user system; deferred to multi-tenancy in Wave 8.

## Open Questions

All major design questions were resolved by AUTH-SPIKE.md. Residual items:

1. **Should `/api/auth/me` be cached in the browser?** Leaning NO for Phase 6. It's a cheap query and refetching on every mount avoids stale-auth-state bugs. Revisit in Wave 8 if it shows up as a perf issue.
2. **Access token rotation policy.** Currently a new access token is issued on every refresh call. Do we need sliding expiry (extend the 15-min window on every API call)? Leaning NO: 15-min fixed + auto-refresh on 401 gives indistinguishable UX with cleaner server semantics.
3. **Should middleware also inspect the `refresh_token` cookie?** Leaning NO. If only the refresh cookie is present (access expired, page reload), the middleware lets the request through and the page's server component fails auth; the client then catches the 401 and refreshes. Adding refresh-cookie awareness to middleware would require verifying the refresh token at the edge, which is a DB call — too expensive per request.

None of these block implementation. Flag back to the user during review if anything changes.

## Verification Plan

Three-part gate before commit.

1. **`ascend-security` audits at three checkpoints** (blocking):
   - After Phase 1 (schema + validation): migration SQL, Zod schemas, password parameter choice.
   - After Phase 3 (service + routes): scrypt implementation, JWT signing + verification, cookie flags, rotation + reuse detection, rate limit correctness, error-message timing safety (constant-time compare on password).
   - After Phase 5 (middleware + login page + api-client migration): middleware path list, redirect logic, 401 interceptor, logout side effects, CSRF posture.

2. **`ax:verify-ui` scenarios** (blocking):
   - Unauthenticated visit to `/` → redirects to `/login?redirect=/`.
   - Login with valid credentials → redirects to `/`, cookies set, network shows `/api/auth/login` 200.
   - Login with invalid credentials → stays on `/login`, shows inline error, no cookies set.
   - Login, then full page reload → still signed in (cookie persists).
   - Login, wait for access token expiry (or force it by clearing the cookie), navigate to `/goals` → network shows a 401 on the first fetch, then `/api/auth/refresh` 200, then the retry succeeds transparently.
   - Rotation reuse: simulate (via a two-tab setup) one tab calling refresh while the other uses the old refresh → second call 401, both sessions forced to login.
   - Logout → cookies cleared, redirected to `/login`, cache cleared.
   - MCP smoke: send `curl -H "Authorization: Bearer $API_KEY" http://localhost:3001/api/mcp ...` with `tools/list` → returns 37 tools. Repeat for 5 representative tool calls, all 200.

3. **`ax:review`** (blocking): zero safety rule violations. Zero pattern violations in service, routes, middleware, components.

4. **Build gates**: `npx tsc --noEmit` passes. `pnpm --filter @ascend/web build` passes with bundle size within 5%.

5. **Manual Dia smoke** (after dev-server stop/start + cookie clear): login → navigate all pages → refresh after 15 min → logout → retry protected page → redirected to login. Screenshots saved to `.ascendflow/verification/2026-04-xx-wave0-phase6-manual.md`.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Password set-password script fails silently for seed user | Low | Critical (locked out) | Script prints a clear success line with the user id + timestamp; failure exits non-zero with the error. Developer tests locally before running on prod DB. |
| JWT secret missing or too weak in production | Medium | Critical | Startup check in `authService`: if `AUTH_JWT_SECRET` is unset or <32 bytes, throw during module init. Next.js surface the error in logs within seconds of deploy. |
| API client 401 interceptor creates infinite refresh loop | Medium | High | Interceptor deduplicates: if a refresh is already in flight, queue subsequent 401-triggered retries on the same promise. If refresh itself 401s, no further refresh is attempted; hard redirect. |
| MCP auth accidentally broken | Low | Critical | `authenticate()` keeps the `validateApiKey` logic as the fallback branch, unchanged in substance. First `ascend-security` audit checkpoint tests `/api/mcp` with the exact existing API key. |
| `search_vector` tsvector dropped by generated migration | Low | Critical | `ascend-migration-auditor` explicitly greps the generated SQL for `search_vector` and `ContextEntry` DDL; any match blocks apply. |
| Cookie flags wrong in production (missing Secure, wrong SameSite) | Low | High | Hardcoded per-environment defaults in `authService.buildCookieOptions()`; second audit checkpoint verifies flags in a test response. |
| `NEXT_PUBLIC_API_KEY` removal breaks some bare-fetch call site | Low | Medium | Grep for `NEXT_PUBLIC_API_KEY` uses before removal; migrate any stragglers (the 3 bare-fetch call sites noted in Phase 4 follow-ups) to use the cookie-backed api-client. |
| In-process rate limiter leaks memory | Low | Low | Map entries age out on access (check `resetAt` before bumping). A periodic prune runs on the fly during each check. Documented as single-node-only. |
| Login page accessibility | Medium | Medium | Follow `.claude/rules/accessibility.md`. Labels on inputs (no placeholder-only labels), focus-visible ring, error announced via `role="alert"`, Escape cancels submit-in-progress, keyboard submit via Enter. |

## Size Estimate

**Target: 2 working days solo.**

- Day 1: Phases 1-3 (schema + validation + authService + login/refresh/logout routes + `ascend-security` checkpoint 1 and 2).
- Day 2: Phases 4-6 (middleware + login page + api-client 401 interceptor + `/api/auth/me` + seed script + `ascend-security` checkpoint 3 + `ax:verify-ui` + `ax:review` + commit).

If the first `ascend-security` checkpoint blocks (e.g., scrypt parameters need adjustment), lose 2-3 hours. If the rotation logic needs a second pass after UI testing, lose another 2-3 hours. Hard cap: 3 working days before flagging scope for renegotiation.

## Handoff

Phase 6 closes when the commit `feat(auth): token-based auth with JWT access + rotating refresh tokens` lands. Wave 0 then moves to Phase 7 (presigned R2 upload) which depends on nothing from Phase 6 except that auth works. Phase 7 is a 1-day task.

The Wave 0 continue prompt will be updated post-commit to mark Phase 6 DONE with the new HEAD SHA.
