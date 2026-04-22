# Implementation Tasks: Wave 0 Phase 6 (Token Auth)

Order matters. Each task includes the exact files it touches and the layer it implements. **Every task must pass before the next begins**, except where two tasks are marked "PARALLEL OK". The three `ascend-security` checkpoints are blocking gates.

## Phase 1: Schema + validation + deps

- [ ] **1.1** Install `jose` in the web app. Command: `pnpm --filter @ascend/web add jose`. Verify by checking `apps/web/package.json` has `"jose": "^5"` or later, and `pnpm-lock.yaml` updates.

- [ ] **1.2** Add `passwordHash String?` to the User model in `apps/web/prisma/schema.prisma`. Insert immediately after the existing `apiKey` line. No other schema changes.

- [ ] **1.3** Generate the migration via the `/ax:migrate` skill (which wraps `prisma migrate dev --name add_user_password` with safety checks). Delegate SQL review to `ascend-migration-auditor`. Expected SQL: exactly `ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;`. Anything else is a red flag; do not apply.

- [ ] **1.4** Create `packages/core/src/schemas/auth.ts` with Zod schemas:
  ```ts
  import { z } from "zod";

  export const loginSchema = z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(12).max(256),
  });
  export type LoginInput = z.infer<typeof loginSchema>;

  export const registerSchema = loginSchema.extend({
    name: z.string().min(1).max(100).optional(),
  });
  export type RegisterInput = z.infer<typeof registerSchema>;

  // Refresh takes its token from the httpOnly cookie, so body is empty.
  // The empty object schema keeps a Zod parse in the route handler symmetric
  // with other routes.
  export const refreshSchema = z.object({}).strict();
  ```
  Re-export from `packages/core/src/index.ts`. Verify `apps/web/lib/validations.ts` re-exports from `@ascend/core` correctly for the new schemas (or add fresh re-exports if needed).

- [ ] **1.5** Add env vars to `apps/web/.env.example`:
  ```
  # Auth (Phase 6)
  AUTH_JWT_SECRET=<minimum 32 bytes of randomness; generate via: openssl rand -base64 48>
  # Optional:
  AUTH_REFRESH_TOKEN_PEPPER=
  COOKIE_DOMAIN=
  ```
  Do NOT add real values; `.env.example` is the documentation, not the source of truth.

- [ ] **1.6** **`ascend-security` checkpoint 1 (BLOCKING).** Delegate to the agent with: schema change, Zod schemas, env var plan. Expected PASS. FAIL blocks Phase 2.

- [ ] **1.7** Run `/ax:test`. Must pass (tsc + build).

## Phase 2: Auth service (the core)

- [ ] **2.1** Extend `apps/web/lib/services/user-service.ts` with:
  - `findByEmail(email: string)` → `prisma.user.findUnique({ where: { email } })`. Returns `User | null`. No userId scoping needed (email is the query input).
  - `setPassword(userId: string, passwordHash: string)` → `prisma.user.update({ where: { id: userId }, data: { passwordHash } })`.

  Both follow existing `userService` patterns in the same file.

- [ ] **2.2** Create `apps/web/lib/services/auth-service.ts` as a const object with these methods (signatures fixed; implementation details in comments per method):

  ```ts
  // Imports: crypto (Node built-in), jose (SignJWT, jwtVerify), prisma, userService.

  // Module-init guard: at module load, read AUTH_JWT_SECRET. If missing or <32
  // chars, throw during init. This surfaces missing secrets in deploy logs.
  const JWT_SECRET: Uint8Array = /* TextEncoder.encode(process.env.AUTH_JWT_SECRET) */;

  export const authService = {
    // --- Password hashing (scrypt, N=2^17 r=8 p=1 salt 16B key 64B) ---
    async hashPassword(password: string): Promise<string>;
    async verifyPassword(password: string, storedHash: string): Promise<boolean>; // constant-time compare

    // --- JWT ---
    async signAccessToken(userId: string, email: string): Promise<string>; // 15 min
    async verifyAccessToken(token: string): Promise<{ userId: string } | null>; // null on invalid/expired

    // --- Refresh tokens (opaque hex, stored as SHA-256) ---
    generateRefreshTokenRaw(): string; // 256-bit hex, used for the cookie value
    hashRefreshToken(raw: string): string; // SHA-256 hex, used for the Session row

    // --- Sessions ---
    async createSession(userId: string, meta: { userAgent?: string; ipAddress?: string; deviceName?: string }): Promise<{ accessToken: string; refreshTokenRaw: string; session: Session }>;
    async rotateSession(presentedRefreshRaw: string): Promise<{ accessToken: string; refreshTokenRaw: string; session: Session } | { error: "expired" | "reuse" | "not_found" }>;
    async revokeSession(sessionId: string): Promise<void>;
    async revokeFamily(familyId: string): Promise<void>; // bulk-sets revokedAt for all siblings

    // --- Rate limiting (in-process Map) ---
    checkLoginRateLimit(email: string): { allowed: boolean; retryAfterSeconds?: number };
    recordLoginFailure(email: string): void;
    resetLoginRateLimit(email: string): void;

    // --- Cookie helpers ---
    buildAccessCookieOptions(): CookieOptions; // httpOnly, Secure (prod), SameSite=Lax, path=/, maxAge=900
    buildRefreshCookieOptions(): CookieOptions; // same + maxAge=2592000
    buildClearCookieOptions(): CookieOptions; // maxAge=0, same other flags
  };
  ```

  **Rotation + reuse detection pseudocode** (encode in comment above `rotateSession`):
  ```
  1. hash = SHA-256(presentedRefreshRaw)
  2. session = prisma.session.findUnique({ where: { refreshTokenHash: hash } })
  3. if !session → { error: "not_found" }
  4. if session.revokedAt → // REUSE DETECTED: token was valid at some point but was revoked.
       await revokeFamily(session.familyId)
       return { error: "reuse" }
  5. if session.expiresAt <= now → { error: "expired" }
  6. within a Prisma transaction:
       mark current session.revokedAt = now, lastUsedAt = now
       create new session with same familyId, new hash, new expiresAt (now + 30d)
  7. return { accessToken: signAccessToken(...), refreshTokenRaw, session: newRow }
  ```

  Every Prisma query includes `userId` where the shape demands it (e.g., `revokeFamily` can be scoped by family without userId because family is an internal cuid, not user-facing; but `createSession` takes userId). `ascend-security` verifies userId scoping.

  **Rate limit storage:** module-level `Map<string, { attempts: number; resetAt: number }>`. No persistence.

- [ ] **2.3** Upgrade `apps/web/lib/auth.ts` `validateApiKey(request)` to `authenticate(request)`. Keep `validateApiKey` exported as a thin alias.
  - New logic in priority order:
    1. `access_token` cookie → `authService.verifyAccessToken(token)` → if `{ userId }`, return `{ success: true, userId }`.
    2. `Authorization: Bearer <token>` header:
       - First try `authService.verifyAccessToken(token)`. If valid, return `{ success: true, userId }`. (Covers Wave 6 Expo native clients.)
       - Else fall back to `userService.findByApiKey(token)`. If hit, return `{ success: true, userId: user.id }`. (Covers MCP.)
    3. Neither → `{ success: false }`.
  - Add a comment above `validateApiKey` explaining it is a compatibility alias and callers should prefer `authenticate`.

- [ ] **2.4** **`ascend-security` checkpoint 2 (BLOCKING).** Delegate with: `auth-service.ts` full contents, `user-service.ts` additions, `auth.ts` upgrade. Expected audit items:
  - Scrypt parameters match AUTH-SPIKE decisions (N=2^17, r=8, p=1, salt 16B, key 64B).
  - `verifyPassword` uses `crypto.timingSafeEqual`.
  - JWT secret is validated at module init.
  - Rotation logic prevents concurrent-race double-rotation (wrap in transaction + unique constraint on `refreshTokenHash`).
  - Reuse detection revokes the whole family.
  - Rate limiter is per-email, per 15-min window, resets on success.
  - Cookie flags are correct: httpOnly, Secure-in-prod, SameSite=Lax, path=/, Max-Age correct.
  - `authenticate()` preserves the API key path for MCP 100%.
  - No secret leakage in error messages (generic "Invalid credentials" for bad password AND unknown email).

  FAIL blocks Phase 3.

- [ ] **2.5** Run `/ax:test`.

## Phase 3: Auth API routes

- [ ] **3.1** Create `apps/web/app/api/auth/login/route.ts`.
  - `POST`: parse body with `loginSchema`.
  - Call `authService.checkLoginRateLimit(email)`; if not allowed, respond 429 with `Retry-After`.
  - Call `userService.findByEmail(email)`. If null, call `recordLoginFailure(email)` and return 401 with generic message.
  - If `user.passwordHash` is null (seed user hasn't set a password), return 401 generic.
  - Call `authService.verifyPassword(password, user.passwordHash)`. On false, record failure, return 401.
  - On true, `resetLoginRateLimit(email)`. Extract `userAgent`, `ipAddress` (from `request.headers.get("x-forwarded-for")` or similar) for session metadata.
  - Call `authService.createSession(user.id, meta)`.
  - Set `access_token` and `refresh_token` cookies on the response.
  - Return 200 with `{ user: { id, email, name } }`.
  - Follow the existing auth-parse-service-respond pattern from `.claude/rules/api-route-patterns.md`. Use `handleApiError` for unexpected errors.

- [ ] **3.2** Create `apps/web/app/api/auth/refresh/route.ts`.
  - `POST`: read `refresh_token` cookie.
  - If absent, return 401, clear any stale cookies.
  - Call `authService.rotateSession(refreshRaw)`.
  - On `{ error }`, return 401 with `{ error: "Session expired" }`, clear both cookies.
  - On success, set new `access_token` and `refresh_token` cookies, return 200 with `{}`.
  - No Zod body parse (empty body), but do validate the cookie exists.

- [ ] **3.3** Create `apps/web/app/api/auth/logout/route.ts`.
  - `POST`: read `refresh_token` cookie.
  - If present, hash it, find the session, call `authService.revokeSession(sessionId)` if found.
  - Always clear both cookies on the response.
  - Always return 200 (idempotent logout).

- [ ] **3.4** Create `apps/web/app/api/auth/me/route.ts`.
  - `GET`: call `authenticate(request)`. If success false, return 401.
  - Fetch the user from Prisma via `userService.findById(userId)` (add this method to userService if not already there; trivial wrapper).
  - Return `{ user: { id, email, name } }`.

- [ ] **3.5** Run `/ax:test`.

## Phase 4: Middleware

- [ ] **4.1** Create `apps/web/middleware.ts`.
  - Matcher: run on all routes EXCEPT `/_next/*`, `/api/auth/*`, `/login`, `/static`, and file assets. Use Next.js `config.matcher` with a negative regex or an allowlist.
  - Logic:
    - If path starts with `/api/*` (including `/api/mcp`, `/api/goals`, etc.) → DO NOT redirect. Pass through. The route handler's `authenticate()` does the real check. Middleware's job is only HTML page protection.
    - Else (HTML page request): check for `access_token` cookie.
      - If absent → redirect to `/login?redirect=<encoded pathname>`.
      - If present, do a cheap presence check only (no `jose.verify` in middleware to avoid edge-runtime Prisma-free JWT verification complexity; the route handler's `authenticate()` does the full check; if the cookie is present but invalid, the user sees a flash of the protected page then the client-side 401 interceptor kicks in). Rationale: middleware is a coarse gate, not a precise one.

  **Decision:** `jose.jwtVerify` IS edge-safe. So we can do a full verify in middleware. On verification failure in middleware, redirect to `/login?redirect=<path>` and clear the cookie. This is cleaner than the flash-of-protected-page approach.

  Revise logic:
    - Allowlist: `/api/*`, `/_next/*`, `/login`, `/static/*`, and asset extensions.
    - For every other path: verify `access_token` cookie via `jose.jwtVerify(token, JWT_SECRET)`. On fail → redirect to `/login?redirect=<path>` with `access_token` cookie cleared in the response.

- [ ] **4.2** Run `/ax:test` focusing on edge-runtime compatibility. `jose` is edge-safe; `crypto.scrypt` is NOT (we don't use it in middleware). Verify build succeeds for middleware.

## Phase 5: Login page + UI

- [ ] **5.1** Create `apps/web/app/(auth)/layout.tsx`. Minimal layout (no sidebar, no header). Centers content in the viewport. Includes a minimal `<Toaster />` for `sonner`.

- [ ] **5.2** Create `apps/web/app/(auth)/error.tsx` (Next.js error boundary for the (auth) segment). Renders a simple error card with a "Try again" link to `/login`. Satisfies DZ-7 for the new auth surface.

- [ ] **5.3** Create `apps/web/app/(auth)/login/page.tsx`. Client component.
  - Card centered via Tailwind. Heading "Sign in to Ascend". Two inputs (email + password) with `<label>` elements (accessibility), submit button "Sign in".
  - On submit: call `api.post("/api/auth/login", { email, password })` via `@ascend/api-client`. The post helper returns parsed JSON.
  - Success: read `searchParams` for `redirect`, fallback to `/`. `router.push(redirect)`.
  - 401 response: show `role="alert"` inline error "Invalid email or password."
  - 429 response: show `role="alert"` "Too many attempts. Please wait 15 minutes."
  - Loading state: disable inputs and button, show "Signing in…" on button.
  - Enter key submits (default form behavior). Escape key is NOT hijacked (no in-page overlay).
  - Follow `.claude/rules/accessibility.md`: labels associated with inputs, focus-visible ring, error announced via role=alert.

- [ ] **5.4** Create `apps/web/components/auth/logout-button.tsx`. A small `<Button variant="ghost">` that calls `api.post("/api/auth/logout")` on click and then `router.push("/login")`. Clears React Query cache via `queryClient.clear()` on success. Takes an optional `className` prop.

- [ ] **5.5** Wire the logout button into the sidebar settings menu. Look in `apps/web/components/layout/app-sidebar.tsx` for the existing settings/user area; add the logout button near the theme toggle (or inside the user popover if one exists). Do NOT create a new UI section; use the existing one.

## Phase 6: API-client 401 interceptor + API_KEY removal

- [ ] **6.1** Update `apps/web/lib/api-client.ts`:
  - Remove the `API_KEY` import and the `apiHeaders` export's `Authorization` line.
  - If any caller still imports `apiHeaders`, leave the export as `{ "Content-Type": "application/json" }` (without Authorization). This prevents hard breaks on the 3 bare-fetch call sites flagged in Phase 4 follow-ups; they'll still work with cookies.
  - Rewrite `apiFetch<T>(url, init?)`: on 401 response, run the refresh-and-retry flow:
    - If `url.startsWith("/api/auth/")` → rethrow (no refresh recursion).
    - Else, call `fetch("/api/auth/refresh", { method: "POST", credentials: "include" })` (bypassing our own `apiFetch` to avoid interceptor recursion).
    - If refresh returns 200 → retry the original request once with the same init. On success, return. On another 401, fall through to redirect.
    - If refresh returns 401 → `queryClient.clear()` is not available here (different module); emit a custom event `ascend:session-expired` on `window` that the app layout listens for, then `window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname + window.location.search)`.
  - Deduplicate in-flight refreshes: a module-level `let refreshInFlight: Promise<Response> | null = null`. If present, subsequent 401s `await` the same promise instead of starting a new one.

- [ ] **6.2** Add a listener for `ascend:session-expired` in `apps/web/app/(app)/layout.tsx` (the authenticated app layout). On event, call `queryClient.clear()` via the existing `QueryClientProvider` reference. The listener can be wired via a `useEffect` in a tiny client component mounted inside the layout.

- [ ] **6.3** Grep for `NEXT_PUBLIC_API_KEY` across `apps/web/`. Any call site other than server-only code (MCP tests, scripts) must be migrated to rely on cookies.
  - `apps/web/lib/hooks/use-dashboard.ts` fire-and-forget call → migrate to `api.post(...)`.
  - `apps/web/components/settings/export-section.tsx` → migrate to `api.post(...)`.
  - `apps/web/components/onboarding/onboarding-mcp-guide.tsx` → review; this one references the API key for MCP docs display, which is a legitimate display use. Keep if so.
  - Document remaining legitimate uses in a code comment.

## Phase 7: Seed script

- [ ] **7.1** Create `apps/web/scripts/set-password.ts`:
  ```ts
  #!/usr/bin/env node
  // Usage:
  //   ASCEND_EMAIL=you@example.com ASCEND_PASSWORD='<pw>' pnpm --filter @ascend/web tsx scripts/set-password.ts
  // Safety: exits non-zero on any validation error. Password min 12 chars. No logging of the password or the hash.
  ```
  - Validates `ASCEND_EMAIL` and `ASCEND_PASSWORD` env vars.
  - Enforces password length >= 12.
  - Hashes with `authService.hashPassword`.
  - Updates `User.passwordHash` where `email = ASCEND_EMAIL`.
  - Prints success with user id and timestamp, or error with reason.

- [ ] **7.2** Add a convenience script to `apps/web/package.json` (optional):
  ```json
  "scripts": {
    "auth:set-password": "tsx scripts/set-password.ts"
  }
  ```
  Optional because running via `pnpm --filter @ascend/web tsx scripts/set-password.ts` already works.

## Phase 8: ascend-security checkpoint 3 + verification

- [ ] **8.1** **`ascend-security` checkpoint 3 (BLOCKING).** Delegate with: middleware, login page, logout button, api-client interceptor, seed script. Audit items:
  - Middleware matcher doesn't accidentally protect `/api/auth/*` or `/login` itself (causing redirect loops).
  - 401 interceptor deduplicates and doesn't leak original request bodies on retry (reuse `init` is fine; recomputing bodies from generators is a footgun if the init.body is a stream).
  - Logout clears cookies even when no session is found.
  - Seed script does not log secrets.
  - No XSS or injection in the login form (React escapes by default; confirm).
  - No leakage of the `access_token` cookie to client-side JS (httpOnly is set; confirm via DevTools in the `ax:verify-ui` pass).

  FAIL blocks the final verification.

- [ ] **8.2** Run `/ax:test`. Must pass.

- [ ] **8.3** Run `/ax:review`. Zero safety violations. Zero accessibility violations on the login page.

- [ ] **8.4** Run `/ax:verify-ui` with a Phase 6 scenario plan:
  1. Cold start → visit `/` → expect redirect to `/login?redirect=/`.
  2. Submit invalid credentials → inline error shown, stays on `/login`.
  3. Rapid 6 invalid attempts → 6th returns 429 rate-limit inline error.
  4. Submit valid credentials → redirect to `/`, sidebar and dashboard render, cookies visible in DevTools (httpOnly, Secure=false in dev, SameSite=Lax).
  5. Hard reload after login → still authenticated, dashboard renders.
  6. Clear `access_token` cookie (leave `refresh_token`), navigate to `/goals` → network shows a background `POST /api/auth/refresh`, original request retries successfully.
  7. Clear both cookies, navigate to `/goals` → redirect to `/login?redirect=/goals`, login → redirected back to `/goals`.
  8. Click logout → cookies cleared, on `/login`.
  9. MCP smoke from CLI: `curl -H "Authorization: Bearer $API_KEY" http://localhost:3001/api/mcp -d '{"method":"tools/list",...}'` → 37 tools returned.
  10. MCP tool call: `get_dashboard` via the MCP endpoint with API key → 200, shape unchanged.

  Write the report to `.ascendflow/verification/2026-04-xx-wave0-phase6-verification.md`.

- [ ] **8.5** Manual Dia smoke: full flow, screenshots captured, saved alongside the verification report.

## Phase 9: Commit

- [ ] **9.1** Re-read this TASKS.md end to end. Confirm every checkbox above is checked.

- [ ] **9.2** Stage: `apps/web/prisma/schema.prisma`, the new migration directory, `packages/core/src/schemas/auth.ts`, `packages/core/src/index.ts`, `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/.env.example`, `apps/web/lib/services/auth-service.ts`, `apps/web/lib/services/user-service.ts`, `apps/web/lib/auth.ts`, `apps/web/app/api/auth/**`, `apps/web/middleware.ts`, `apps/web/app/(auth)/**`, `apps/web/components/auth/logout-button.tsx`, `apps/web/components/layout/app-sidebar.tsx` (the logout wiring), `apps/web/lib/api-client.ts`, any migrated bare-fetch call sites, `apps/web/scripts/set-password.ts`, and `.ascendflow/verification/2026-04-xx-wave0-phase6-verification.md`.

- [ ] **9.3** Commit with subject `feat(auth): token-based auth with JWT access + rotating refresh tokens` and a body that lists the spike reference, every new file, the preserved MCP auth path, and the three `ascend-security` checkpoint PASS references. Follow the commit pattern from the Wave 0 continue prompt's Phase 4 template.

- [ ] **9.4** Update `.ascendflow/features/context-v2/wave-0-platform-foundation/TASKS.md`: tick all Phase 6 checkboxes (6.1 through 6.15).

- [ ] **9.5** Update the Wave 0 continue prompt at `~/.claude/continue-prompts/ascend-wave-0-platform-foundation.md`: add the new commit SHA, mark Phase 6 DONE, update HEAD.

- [ ] **9.6** Run `/ax:deploy-check` as an advisory gate only. **Do NOT push.** Wave 0 is holding all commits locally until wave-close verification (Phase 9 of the Wave 0 plan). `ax:deploy-check` here exists to catch any deploy-blocking issue early so it isn't discovered at wave-close. If it fails, fix before the commit lands or document the gap for the wave-close pass.

## Verification Summary (Post-Phase 9)

Before declaring Phase 6 complete, confirm the completion checklist from the Ascend Execution Quality Bar:

- [ ] `npx tsc --noEmit` passes with zero errors.
- [ ] `pnpm --filter @ascend/web build` passes with zero errors, bundle within 5% of baseline.
- [ ] Every Prisma query in `authService` and `userService` includes correct scoping.
- [ ] Every POST route parses body through Zod (login: loginSchema; refresh: refreshSchema; logout: no body required, no parse).
- [ ] No new direct `@prisma/client` or `@/lib/db` imports outside `apps/web/lib/services/`.
- [ ] `ascend-security` returned PASS at all three checkpoints.
- [ ] `ax:verify-ui` returned PASS or PASS WITH NOTES with zero blocking scenarios.
- [ ] `ax:review` returned zero violations.
- [ ] All relevant patterns from `.claude/rules/` followed (service-patterns, api-route-patterns, component-patterns, accessibility).
- [ ] MCP API key path verified working in the UI verification step (curl smoke).

If any of the above is NOT DONE, do not declare Phase 6 complete. Flag gaps to the user per the Execution Quality Bar rule.
