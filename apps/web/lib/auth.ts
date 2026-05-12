import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { userService } from "@/lib/services/user-service";
import { authService } from "@/lib/services/auth-service";
import { workspaceContextService } from "@/lib/services/workspace-context-service";
import { ZodError } from "zod";

// ---------------------------------------------------------------------------
// AuthResult type
//
// SUPERSET of the old { success: true; userId: string } shape.
// Existing callers that destructure { userId } continue to work because
// workspaceId is an additional field. New callers can also grab workspaceId.
// ---------------------------------------------------------------------------

type AuthResult =
  | { success: true; userId: string; workspaceId: string }
  | { success: false };

// ---------------------------------------------------------------------------
// authenticate(request): three-path user resolution + workspace resolution
//
// Priority order:
//   1. access_token cookie -> JWT verify (web users post-Phase-6)
//   2. Authorization: Bearer <token> header:
//      a. Try JWT verify FIRST (cheap: in-memory jose verify, no DB call)
//      b. Fall back to API key DB lookup (MCP tools, scripts, legacy callers)
//   3. Neither -> unauthenticated
//
// Workspace resolution:
//   - Cookie/Bearer JWT path: read currentWorkspaceId from the JWT payload.
//     If missing (pre-Phase-3a token), fall back to
//     workspaceContextService.resolveDefaultWorkspaceId.
//   - API key path: always resolve via workspaceContextService (API keys
//     do not carry workspace context).
//   - If workspace cannot be resolved (null), return { success: false }.
//
// Why JWT is tried before API key in the header path: a valid JWT will
// never collide with an API key (different format). Trying JWT first is
// pure in-memory cryptography (microseconds), while the API key path
// requires a DB round-trip. This ordering prevents a leaked API key
// from being interpreted as a JWT and avoids unnecessary DB lookups for
// JWT-authenticated callers (e.g., Wave 6 native clients).
// ---------------------------------------------------------------------------

export async function authenticate(request: NextRequest): Promise<AuthResult> {
  // Path 1: access_token cookie (web browser sessions)
  const accessCookie = request.cookies.get("access_token")?.value;
  if (accessCookie) {
    const result = await authService.verifyAccessToken(accessCookie);
    if (result) {
      const workspaceId = await _resolveWorkspaceId(
        result.userId,
        result.currentWorkspaceId,
      );
      if (!workspaceId) return { success: false };
      return { success: true, userId: result.userId, workspaceId };
    }
    // Fall through on invalid/expired cookie. The user might also have
    // a valid Bearer header (rare edge case during migration), and the
    // client-side 401 interceptor will handle refresh if needed.
  }

  // Path 2 + 3: Authorization: Bearer <token> header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();

    // 2a: Try JWT verification first (cheap, in-memory)
    const jwtResult = await authService.verifyAccessToken(token);
    if (jwtResult) {
      const workspaceId = await _resolveWorkspaceId(
        jwtResult.userId,
        jwtResult.currentWorkspaceId,
      );
      if (!workspaceId) return { success: false };
      return { success: true, userId: jwtResult.userId, workspaceId };
    }

    // 2b: Fall back to API key DB lookup (MCP tools, scripts, legacy)
    // API keys do not carry workspaceId; resolve from the user's default.
    const user = await userService.findByApiKey(token);
    if (user) {
      const workspaceId =
        await workspaceContextService.resolveDefaultWorkspaceId(user.id);
      if (!workspaceId) return { success: false };
      return { success: true, userId: user.id, workspaceId };
    }
  }

  return { success: false };
}

/**
 * Resolve the workspace ID from the JWT claim or by fallback lookup.
 *
 * If currentWorkspaceId is present in the JWT, use it directly.
 * Otherwise (pre-Phase-3a tokens, or null claim), resolve via the
 * user's defaultWorkspaceId with workspaceContextService.
 */
async function _resolveWorkspaceId(
  userId: string,
  currentWorkspaceId: string | null,
): Promise<string | null> {
  if (currentWorkspaceId) return currentWorkspaceId;
  return workspaceContextService.resolveDefaultWorkspaceId(userId);
}

/**
 * Backward-compatible alias for authenticate().
 *
 * All existing route handlers (50+ files) call validateApiKey(request).
 * This alias preserves that contract without source changes. Prefer
 * authenticate() in new code.
 *
 * The returned shape is a SUPERSET of the old { success, userId } shape.
 * Existing destructures like { success, userId } = await validateApiKey(req)
 * continue to work; new callers can also grab workspaceId.
 */
export const validateApiKey = authenticate;

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.issues },
      { status: 400 }
    );
  }
  if (error instanceof Error) {
    // Permission denied errors from permissionService.assertCanPerform
    // and workspace service methods surface as 403, not 400.
    if (error.message.startsWith("Permission denied")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    // "Cannot delete the only workspace" from workspaceService.delete
    // also surfaces as 403.
    if (error.message.startsWith("Cannot delete the only workspace")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    // Service layer errors (e.g., hierarchy validation, not found)
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

// ---------------------------------------------------------------------------
// verifyCronSecret(request): timing-safe cron secret validation
//
// Used by cron-only routes (context map refresh, file extraction tick,
// file cleanup, anything else triggered by GitHub Actions). Verifies the
// x-cron-secret header matches the CRON_SECRET env var using timing-safe
// comparison to prevent side-channel attacks.
//
// Returns false if CRON_SECRET is not set or header is missing.
// ---------------------------------------------------------------------------

export function verifyCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const provided = request.headers.get("x-cron-secret");
  if (!provided) return false;

  try {
    const a = Buffer.from(provided, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    // Length check first; timingSafeEqual throws on length mismatch.
    // Length itself leaks, but the actual content does not.
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// verifyCrdtPersistSecret(request): timing-safe CRDT persist secret validation
//
// Used by the internal /api/blockdocs/[entryId]/persist endpoint, called
// exclusively by the Hocuspocus CRDT server to persist Yjs document state.
// Verifies the x-crdt-secret header matches the CRDT_PERSIST_SECRET env var
// using timing-safe comparison to prevent side-channel attacks. Separate from
// CRON_SECRET so compromise of one does not cascade to the other.
//
// Returns false if CRDT_PERSIST_SECRET is not set or header is missing.
// ---------------------------------------------------------------------------

export function verifyCrdtPersistSecret(request: NextRequest): boolean {
  const expected = process.env.CRDT_PERSIST_SECRET;
  if (!expected) return false;

  const provided = request.headers.get("x-crdt-secret");
  if (!provided) return false;

  try {
    const a = Buffer.from(provided, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
