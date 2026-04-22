import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validations";
import { userService } from "@/lib/services/user-service";
import { authService } from "@/lib/services/auth-service";
import { handleApiError } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request body (ZodError -> 400 via handleApiError)
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    // 2. Rate limit check (429 short-circuits before any DB lookup)
    const rateLimit = authService.checkLoginRateLimit(email);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait before trying again." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    // 3. Look up user by email
    const user = await userService.findByEmail(email);

    // 4. Timing-safe branch: both paths must burn equivalent CPU
    //    in the scrypt layer to prevent email enumeration via timing.
    if (!user || !user.passwordHash) {
      // User does not exist, or is a seed/API-key-only user without a
      // password set. Run a dummy scrypt to equalize response time.
      await authService.runDummyScryptForTimingSafety();
      authService.recordLoginFailure(email);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const passwordOk = await authService.verifyPassword(
      password,
      user.passwordHash,
    );
    if (!passwordOk) {
      authService.recordLoginFailure(email);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // 5. Success: reset rate limit, create session, set cookies
    authService.resetLoginRateLimit(email);

    const userAgent = request.headers.get("user-agent") ?? undefined;
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      undefined;

    const { accessToken, refreshTokenRaw } = await authService.createSession(
      user.id,
      user.email ?? email,
      { userAgent, ipAddress },
    );

    const response = NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name } },
      { status: 200 },
    );

    response.cookies.set(
      "access_token",
      accessToken,
      authService.buildAccessCookieOptions(),
    );
    response.cookies.set(
      "refresh_token",
      refreshTokenRaw,
      authService.buildRefreshCookieOptions(),
    );

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
