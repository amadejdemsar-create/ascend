import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { handleApiError } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Refresh token comes exclusively from the httpOnly cookie.
    // No body parsing, no header extraction. Cookie-only auth.
    const refreshCookie = request.cookies.get("refresh_token")?.value;

    if (!refreshCookie) {
      // No cookie means no authenticated session. Clear any stale cookies
      // preemptively to prevent stale-cookie loops on the client.
      const response = NextResponse.json(
        { error: "Session expired" },
        { status: 401 },
      );
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
    }

    const result = await authService.rotateSession(refreshCookie);

    if (!result.ok) {
      // not_found, expired, or reuse: all surface as 401 with cookies cleared.
      // The reuse case already triggered revokeFamily inside rotateSession.
      const response = NextResponse.json(
        { error: "Session expired" },
        { status: 401 },
      );
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
    }

    // Rotation succeeded: set new cookies with fresh tokens.
    const response = NextResponse.json({}, { status: 200 });
    response.cookies.set(
      "access_token",
      result.accessToken,
      authService.buildAccessCookieOptions(),
    );
    response.cookies.set(
      "refresh_token",
      result.refreshTokenRaw,
      authService.buildRefreshCookieOptions(),
    );
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
