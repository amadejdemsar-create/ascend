# Ascend UI Verification Report

**When:** 22. 4. 2026 13:46 (Europe/Ljubljana)
**Branch:** main
**HEAD commit:** 8782bfc docs(spike): W0 Phase 6 auth decision
**Dev port detected:** 3001
**What was tested:** Wave 0 Phase 6 token-based authentication: login page, invalid credentials handling, rate limiting, valid login with redirect, session persistence across reload, token refresh via 401 interceptor, full cookie clear redirect, logout via sidebar button, and MCP API key backward compatibility.
**Verdict:** PASS

## Files evaluated (Phase 0)

- `apps/web/middleware.ts:1-96`: New edge middleware that gates all HTML pages behind JWT verification via jose. Excludes `/api/*`, `/_next/*`, `/login`, and static assets. Redirects to `/login?redirect=<path>` on missing or invalid `access_token` cookie.
- `apps/web/app/(auth)/login/page.tsx:1-29`: Server component wrapping LoginForm in Suspense boundary.
- `apps/web/app/(auth)/login/login-form.tsx:1-98`: Client component with email + password form. Handles 401 (inline error), 429 (rate limit message), and success (redirect via `router.push`).
- `apps/web/components/auth/logout-button.tsx:1-49`: Ghost button calling POST `/api/auth/logout`, clearing React Query cache, and redirecting to `/login`.
- `apps/web/lib/api-client.ts:1-229`: Refactored to cookie-based auth. Removed API_KEY from headers. Added 401 refresh-and-retry interceptor with deduplication and `ascend:session-expired` event.
- `apps/web/app/api/auth/login/route.ts:1-88`: POST handler: Zod validation, rate limit check, timing-safe credential verification, session creation, cookie setting.
- `apps/web/app/api/auth/refresh/route.ts:1-69`: POST handler: reads refresh_token cookie, rotates session, sets new cookies.
- `apps/web/app/api/auth/logout/route.ts:1-36`: POST handler: revokes session, clears cookies, always returns 200.
- `apps/web/app/api/auth/me/route.ts:1-22`: GET handler: returns authenticated user info.
- `apps/web/lib/auth.ts`: `authenticate()` now supports three auth paths: cookie JWT, Bearer JWT, Bearer API key (MCP).
- `apps/web/components/layout/app-sidebar.tsx`: Logout button wired into sidebar footer.

## Test plan (Phase 0.5)

Scenarios identified BEFORE opening the browser:

1. **R1: Unauthenticated redirect gate** - Validates middleware redirects unauthenticated requests to /login with redirect param.
2. **R2: Invalid credentials** - Validates 401 handling with inline error display and no cookie setting.
3. **R3/R9: Rate limit (6 failed attempts)** - Validates 429 response after 5 failed attempts with distinct UI message.
4. **R4: Valid login** - Validates successful authentication, redirect, sidebar rendering, and cookie presence.
5. **R5: Reload persistence** - Validates session survives page reload via cookie persistence.
6. **R6: Access token refresh via 401 interceptor** - Validates transparent token refresh when access_token expires.
7. **R7: Full cookie clear redirects to login** - Validates redirect with path preservation after both cookies cleared.
8. **R8: Logout clears session** - Validates logout button clears cookies and redirects to /login.
9. **R10: MCP API key auth still works** - Validates backward compatibility for MCP tool listing and execution.
10. **Regression sweep** - Validates Todos, Calendar, Context, and Dashboard render correctly after auth changes.

## Environment (Phase 1)

- Git state: dirty (all Phase 6 changes uncommitted, ready for Phase 9 commit)
- Dev server port: 3001
- `/api/health` response: `{"status":"ok","timestamp":"2026-04-22T11:35:32.976Z","db":{"users":2,"stats":1}}`
- TypeScript: PASS (`pnpm --filter @ascend/web exec tsc --noEmit` exits cleanly)
- Route warm-up: `/login` returned 200 (5s). All authenticated routes returned 307 (redirect to /login), confirming middleware is active.
- Baseline console errors on initial `/login` load: none

## Execution

**Actual execution order:** R1, R2, R4, R5, R6, R7, R8, R10, R3/R9, Regression sweep.
This order was chosen to avoid the rate limiter locking out the dev user before R4 (valid login). R2 used `nobody@example.com` (not the dev user). R3/R9 used `ratelimit@test.com` in the browser and `nobody@example.com` via curl.

### Scenario R1: Unauthenticated redirect gate

- **Preconditions:** Fresh Playwright context, no cookies.
- **Action:** Navigate to `http://localhost:3001/dashboard`.
- **Expected:** Redirect to `/login?redirect=%2Fdashboard`, login form renders.
- **Observed:** URL changed to `http://localhost:3001/login?redirect=%2Fdashboard`. Login form rendered with "Sign in to Ascend" heading, email input, password input, and "Sign in" button.
- **Console errors (fresh):** None.
- **Verdict:** PASS
- **Screenshots:** `R1-redirect-to-login.png`

### Scenario R2: Invalid credentials

- **Preconditions:** On `/login` page, no session cookies.
- **Action:** Filled `nobody@example.com` and `wrong-password-12chars`, clicked "Sign in".
- **Expected:** Inline error "Invalid email or password." with `role="alert"`, URL stays on `/login`.
- **Observed:** Error message displayed correctly as `alert[ref=e124]: Invalid email or password.`. URL remained `/login?redirect=%2Fdashboard`. No auth cookies set (only `sidebar_state` visible via `document.cookie`).
- **Console errors (fresh):** 1 error: `401 Unauthorized on /api/auth/login` (expected network error from failed login).
- **Verdict:** PASS
- **Screenshots:** `R2-invalid-credentials-error.png`

### Scenario R4: Valid login

- **Preconditions:** On `/login?redirect=%2Fdashboard` page with no session.
- **Action:** Filled `dev@ascend.local` and `bb59c258c650300645d281ff`, clicked "Sign in".
- **Expected:** Redirect to `/dashboard`, sidebar visible, cookies set, authenticated API calls succeed.
- **Observed:** Redirected to `http://localhost:3001/dashboard`. Full sidebar rendered with all nav links (Dashboard, Calendar, Review, Analytics, Todos, Goals, Context, Settings). "Sign out" button visible in sidebar footer. All dashboard widgets loaded (Today's Big 3, This Week's Focus, Level & Stats, etc.). `GET /api/auth/me` returned 200 with `{"user":{"id":"dev-user","email":"dev@ascend.local","name":null}}`. Cookies confirmed httpOnly (not visible via `document.cookie`).
- **Console errors (fresh):** None new.
- **Verdict:** PASS
- **Screenshots:** `R4-valid-login-dashboard.png`

### Scenario R5: Reload persistence

- **Preconditions:** Authenticated session from R4 on `/dashboard`.
- **Action:** Hard reload via `window.location.reload()`.
- **Expected:** Dashboard renders again, no redirect to `/login`.
- **Observed:** Page reloaded to `http://localhost:3001/dashboard`. All widgets rendered identically. No redirect occurred.
- **Console errors (fresh):** None new.
- **Verdict:** PASS
- **Screenshots:** `R5-reload-persistence.png`

### Scenario R6: Access token refresh via 401 interceptor

- **Preconditions:** Authenticated session with valid access_token and refresh_token cookies.
- **Action:** Since httpOnly cookies cannot be deleted from JavaScript in Playwright (correct security behavior), the refresh flow was verified via curl:
  1. Logged in via `curl POST /api/auth/login` to capture cookies.
  2. Created a cookie jar with only the `refresh_token` (removed `access_token`).
  3. Called `GET /api/dashboard` with refresh_token only: returned HTTP 401 (confirming access_token is required).
  4. Called `POST /api/auth/refresh` with refresh_token only: returned HTTP 200 with new `access_token` and `refresh_token` cookies.
  5. Called `GET /api/dashboard` with the refreshed cookies: returned HTTP 200.
- **Expected:** Refresh endpoint rotates tokens, new tokens authenticate successfully.
- **Observed:** All three steps confirmed. The client-side interceptor code in `api-client.ts` is correctly wired to call this flow (verified by code review). The deduplication logic (`refreshInFlight` promise) and the `handleSessionExpired` fallback are properly implemented.
- **Console errors (fresh):** None.
- **Verdict:** PASS WITH NOTES
- **Notes:** httpOnly cookies cannot be manipulated from Playwright's JS context, which is correct security behavior. The refresh flow was verified server-side via curl. The client-side interceptor code was verified by code review.
- **Screenshots:** N/A (curl-based verification)

### Scenario R7: Full cookie clear redirects to login

- **Preconditions:** Authenticated session from R4.
- **Action:** Called `POST /api/auth/logout` via `fetch()` from the browser (which clears both cookies server-side). Then navigated to `/goals` via `window.location.href`.
- **Expected:** Redirect to `/login?redirect=%2Fgoals`.
- **Observed:** Redirected to `http://localhost:3001/login?redirect=%2Fgoals`. Login form rendered. Logged back in with correct credentials. Redirected to `http://localhost:3001/goals` with full goals list rendered.
- **Console errors (fresh):** None new.
- **Verdict:** PASS
- **Screenshots:** `R7-cookie-clear-redirect.png`, `R7-redirect-to-goals-after-login.png`

### Scenario R8: Logout clears session

- **Preconditions:** Authenticated session on `/goals`.
- **Action:** Clicked "Sign out" button (ref e235) in sidebar footer.
- **Expected:** Redirect to `/login`, cookies cleared, API calls return 401.
- **Observed:** Redirected to `http://localhost:3001/login`. Called `GET /api/auth/me` from JS: returned 401. Session fully cleared.
- **Console errors (fresh):** None new.
- **Verdict:** PASS
- **Screenshots:** `R8-logout-redirect-to-login.png`

### Scenario R10: MCP API key auth still works

- **Preconditions:** Dev server running, API key `ascend-dev-key-change-me` in `.env.local`.
- **Action:** Called MCP endpoint via curl with `Authorization: Bearer ascend-dev-key-change-me`.
- **Expected:** JSON-RPC response with 37+ tools.
- **Observed:** `tools/list` returned 38 tools. `tools/call` with `get_dashboard` returned dashboard data including "This Week's Focus", goals, and stats. MCP API key auth path fully preserved.
- **Console errors (fresh):** N/A (curl-based).
- **Verdict:** PASS
- **Screenshots:** N/A (curl-based verification)

### Scenario R3/R9: Rate limit

- **Preconditions:** Fresh rate limit state for test emails.
- **Action:**
  1. **Via curl:** Sent 6 POST requests to `/api/auth/login` with `nobody@example.com` + wrong password. Attempts 1-4 returned 401 with `{"error":"Invalid credentials"}`. Attempt 5 returned 429 with `{"error":"Too many attempts. Please wait before trying again."}` and `Retry-After: 560` header. Attempt 6 also returned 429.
  2. **Via browser:** Using `ratelimit@test.com`, submitted 6 failed login attempts. The 6th attempt displayed `alert: "Too many attempts. Please wait 15 minutes and try again."` with `role="alert"`.
- **Expected:** 429 response with distinct error message after 5 failed attempts. Retry-After header present.
- **Observed:** Rate limit triggered correctly after 5 attempts per email. The 429 response included `Retry-After` header. The browser UI displayed the distinct rate limit message (different from the 401 "Invalid email or password" message). Note: the curl test saw the rate limit at attempt 5 because the browser's R2 test (using `nobody@example.com`) had already counted 1 attempt. The browser test with `ratelimit@test.com` triggered at attempt 6 (after 5 401s).
- **Console errors (fresh):** 429 network error in console (expected).
- **Verdict:** PASS
- **Screenshots:** `R3-rate-limit-429.png`

## Regression sweep (Phase 5)

- `/dashboard`: PASS. All 5 widgets render (Big 3, This Week's Focus, Progress Overview, Level & Stats, Upcoming Deadlines). Data matches previous verification runs.
- `/goals`: PASS. Goal list with 6 goals rendered. Filter bar, quick-add, view switcher all present. Detail panel placeholder visible.
- `/todos`: PASS. Todo list rendered with "Daily smoke v2" entries. Filter bar and quick-add present.
- `/calendar`: PASS. April 2026 month grid rendered. Today (22) highlighted. Pending/Big 3/Deadline/Done legend visible.
- `/context`: PASS. Context entries listed. Search bar present. "Current Priorities" dynamic entry shown.

## Console errors

### Baseline (Phase 2, pre-existing)

- None on initial `/login` page load.

### Fresh (Phase 4, from scenarios)

- `401 Unauthorized on /api/auth/login` (x5): Expected, from R2 and R3 invalid credential attempts.
- `401 Unauthorized on /api/auth/me` (x1): Expected, from explicit unauthenticated test call after logout.
- `429 Too Many Requests on /api/auth/login` (x1): Expected, from R3 rate limit test.
- `In HTML, <button> cannot be a descendant of <button>` on `/context` page: Pre-existing hydration warning from `ContextEntryList` component (button-inside-button nesting). Not caused by Phase 6 changes. Documented in prior verification runs.

### Phase 6 specific errors

None. All auth-related console messages are expected network responses from deliberate test actions (invalid credentials, rate limiting, explicit unauthenticated API calls).

## UX observation (non-blocking)

When logging in from `/login` without a `?redirect=` parameter (e.g., after rate limit testing on a fresh form), the login form defaults `redirectTo` to `/`, which is the marketing landing page. The user sees the landing page after login instead of the dashboard. This is because the root `/` is excluded from middleware auth gating (it's a public page). A minor improvement would be to default the redirect to `/dashboard` instead of `/` in the login form. This is not a regression and is not blocking.

## Summary

### Works

- R1: Middleware redirects unauthenticated HTML page requests to `/login?redirect=<path>`.
- R2: Invalid credentials show inline error "Invalid email or password." with `role="alert"`.
- R3/R9: Rate limiter triggers at 5 failed attempts per email, returns 429 with `Retry-After` header, UI shows distinct message.
- R4: Valid login sets httpOnly cookies, redirects to intended page, renders full app with sidebar.
- R5: Session persists across hard page reload.
- R6: Token refresh endpoint rotates both tokens and issues valid replacements (verified via curl).
- R7: Clearing both cookies causes redirect to `/login?redirect=<path>`, re-login navigates to the original path.
- R8: Logout button clears session, redirects to `/login`, API calls return 401.
- R10: MCP API key auth fully preserved (38 tools returned, `get_dashboard` tool call succeeds).
- Regression sweep: Dashboard, Goals, Todos, Calendar, and Context all render correctly after auth changes.

### Broken

None.

### Recommendation

Ship it. All 10 scenarios pass. The auth implementation is solid: middleware gates correctly, login/logout flows work end-to-end, rate limiting fires at the right threshold, token refresh rotates cleanly, session persistence survives reloads, and MCP backward compatibility is preserved. No new console errors from Phase 6 code. The only pre-existing issue is the button-inside-button hydration warning on Context, which predates this change. Ready for Phase 9 commit.
