import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Read at module load (edge modules are warmed on cold start).
const JWT_SECRET_RAW = process.env.AUTH_JWT_SECRET;
if (!JWT_SECRET_RAW || JWT_SECRET_RAW.length < 32) {
  throw new Error(
    "AUTH_JWT_SECRET must be set and at least 32 characters long in middleware environment.",
  );
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

/**
 * Middleware gate for protected HTML pages.
 *
 * Only runs on HTML page requests (the `config.matcher` below excludes
 * /api/*, /_next/*, /login, and static assets). For those, it verifies
 * the access_token cookie via jose. If verification fails, redirects
 * to /login?redirect=<original path> and clears the bad cookie.
 *
 * Route handlers under /api/* perform their own auth via validateApiKey /
 * authenticate. Middleware deliberately skips them because:
 *   1. /api/mcp is a public-at-middleware endpoint that validates API
 *      keys in its own handler.
 *   2. /api/auth/* routes are the login/refresh/logout endpoints.
 *   3. Every other /api/* route uses validateApiKey which supports both
 *      the cookie path AND the legacy API key path.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const accessToken = request.cookies.get("access_token")?.value;

  // No cookie: redirect to login with the intended destination preserved.
  if (!accessToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Verify JWT. Any failure (bad sig, expired, wrong iss/aud) triggers
  // redirect + cookie clear so the next page load does not loop.
  try {
    await jwtVerify(accessToken, JWT_SECRET, {
      issuer: "ascend",
      audience: "ascend-web",
    });
    // Valid session. Let the request through.
    return NextResponse.next();
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname + request.nextUrl.search);
    const response = NextResponse.redirect(url);

    // Clear the invalid cookie. Flags mirror authService.buildClearCookieOptions
    // (duplicated here because authService uses Node crypto, not edge-compatible).
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      path: string;
      maxAge: number;
      domain?: string;
    } = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    };

    if (process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }

    response.cookies.set("access_token", "", cookieOptions);
    return response;
  }
}

export const config = {
  // Match every path EXCEPT those listed. Uses a negative lookahead regex.
  //
  // Excluded:
  //   /api/*                              route handlers own their auth
  //   /_next/*                            Next.js internals (static, image, etc.)
  //   /login                              the login page itself
  //   /favicon.ico, manifest, robots, sitemap   static public files
  //   /*.(png|jpg|svg|webp|ico|css|js|...)      common asset extensions
  //
  // Everything else (HTML pages under the (app) route group) is gated.
  matcher: [
    "/((?!api|_next/static|_next/image|login|favicon\\.ico|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js)).*)",
  ],
};
