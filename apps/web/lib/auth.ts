import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/lib/services/user-service";
import { authService } from "@/lib/services/auth-service";
import { ZodError } from "zod";

type AuthResult =
  | { success: true; userId: string }
  | { success: false };

// ---------------------------------------------------------------------------
// authenticate(request): three-path user resolution
//
// Priority order:
//   1. access_token cookie -> JWT verify (web users post-Phase-6)
//   2. Authorization: Bearer <token> header:
//      a. Try JWT verify FIRST (cheap: in-memory jose verify, no DB call)
//      b. Fall back to API key DB lookup (MCP tools, scripts, legacy callers)
//   3. Neither -> unauthenticated
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
      return { success: true, userId: result.userId };
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
      return { success: true, userId: jwtResult.userId };
    }

    // 2b: Fall back to API key DB lookup (MCP tools, scripts, legacy)
    const user = await userService.findByApiKey(token);
    if (user) {
      return { success: true, userId: user.id };
    }
  }

  return { success: false };
}

/**
 * Backward-compatible alias for authenticate().
 *
 * All existing route handlers (50+ files) call validateApiKey(request).
 * This alias preserves that contract without source changes. Prefer
 * authenticate() in new code.
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
