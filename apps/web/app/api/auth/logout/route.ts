import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { handleApiError } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const refreshCookie = request.cookies.get("refresh_token")?.value;

    if (refreshCookie) {
      // Look up the session via the service layer (not prisma directly).
      const session =
        await authService.findSessionByRefreshToken(refreshCookie);
      if (session) {
        // Pass userId first per the HIGH-1 fix from checkpoint 2 audit.
        await authService.revokeSession(session.userId, session.id);
      }
    }

    // Idempotent: always clear cookies and return 200, regardless of
    // whether a session was found or revoked. Logout never 401s or 404s.
    const response = NextResponse.json({}, { status: 200 });
    response.cookies.set(
      "access_token",
      "",
      authService.buildClearCookieOptions(),
    );
    response.cookies.set(
      "refresh_token",
      "",
      authService.buildClearCookieOptions(),
    );
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
