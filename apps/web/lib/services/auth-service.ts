import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import type { Session } from "../../generated/prisma/client";
import { userService } from "@/lib/services/user-service";

// ---------------------------------------------------------------------------
// Module-init guard: validate AUTH_JWT_SECRET at load time.
//
// This runs when any module imports auth-service. In production, if the
// secret is missing or too short, the server process crashes immediately
// with a clear error in the deploy logs rather than silently serving
// requests that cannot be signed or verified.
//
// During `next build`, API route modules are compiled but their top-level
// side effects do NOT execute (they only run at server start or first
// request). The guard is therefore build-safe.
// ---------------------------------------------------------------------------
const JWT_SECRET_RAW = process.env.AUTH_JWT_SECRET;
if (!JWT_SECRET_RAW || JWT_SECRET_RAW.length < 32) {
  throw new Error(
    "AUTH_JWT_SECRET must be set and at least 32 characters long. " +
      "Generate one with: openssl rand -base64 48",
  );
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

// ---------------------------------------------------------------------------
// Scrypt parameters (settled in AUTH-SPIKE)
//
// Store hash format: scrypt$N$r$p$saltHex$keyHex
// This is parseable so future param upgrades can read back the original
// params from any stored hash and re-derive correctly.
// ---------------------------------------------------------------------------
const SCRYPT_N = 131072; // 2^17
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_SALT_LEN = 16; // bytes
const SCRYPT_KEY_LEN = 64; // bytes
// Node's default scrypt maxmem is 32 MiB. Our params need 128 * N * r =
// 128 MiB of scratch memory. Without an explicit maxmem override, every
// scrypt call throws "memory limit exceeded." Allocate with 2x headroom
// so future param upgrades (N=2^18, r=8) still fit without another edit.
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

/**
 * Promisified wrapper around crypto.scrypt with ScryptOptions support.
 * The built-in promisify does not infer the overloaded signature with
 * ScryptOptions correctly, so we wrap it manually.
 */
function scryptAsync(
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// ---------------------------------------------------------------------------
// Token lifetimes
// ---------------------------------------------------------------------------
const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 2_592_000; // 30 days

// ---------------------------------------------------------------------------
// Rate limit configuration (in-process, single-node only)
//
// Migration path for multi-node: replace this Map with a Redis
// INCR + EXPIRE pattern behind the same checkLoginRateLimit /
// recordLoginFailure / resetLoginRateLimit interface. The Map is
// pruned on each check to prevent unbounded memory growth (O(n) per
// check, acceptable because the Map should hold at most a few hundred
// entries under normal single-tenant load).
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const loginRateMap = new Map<
  string,
  { attempts: number; resetAt: number }
>();

// ---------------------------------------------------------------------------
// Cookie option types
//
// Using a plain shape that Next.js `cookies().set()` and
// `NextResponse.cookies.set()` both accept.
// ---------------------------------------------------------------------------
type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  domain?: string;
};

// Fixed placeholder for timing-safe dummy scrypt hashing.
// This value is never stored or compared; it exists solely so that the
// login handler can burn the same CPU time on "unknown email" as on
// "wrong password," preventing timing-based email enumeration.
const DUMMY_PASSWORD_PLACEHOLDER = "ascend-timing-safe-placeholder-value";
const DUMMY_SALT = crypto.randomBytes(SCRYPT_SALT_LEN);

export const authService = {
  // =========================================================================
  // Password hashing (scrypt)
  // =========================================================================

  /**
   * Hash a password using scrypt with the settled parameters.
   * Returns a self-describing string: scrypt$N$r$p$saltHex$keyHex
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(SCRYPT_SALT_LEN);
    const key = await scryptAsync(password, salt, SCRYPT_KEY_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    });

    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
  },

  /**
   * Verify a password against a stored hash.
   *
   * Parses the self-describing hash format to extract the original params
   * (supports future param upgrades). Uses crypto.timingSafeEqual to
   * prevent timing attacks on the key comparison.
   */
  async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<boolean> {
    const parts = storedHash.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") {
      return false;
    }

    const n = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = Buffer.from(parts[4], "hex");
    const storedKey = Buffer.from(parts[5], "hex");

    const computedKey = await scryptAsync(password, salt, storedKey.length, {
      N: n,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });

    // Length check before timingSafeEqual (which throws on mismatched lengths)
    if (storedKey.length !== computedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(storedKey, computedKey);
  },

  // =========================================================================
  // JWT (access tokens)
  // =========================================================================

  /**
   * Sign a short-lived access token (15 minutes).
   *
   * Claims: { sub: userId, email, iat, exp, iss: "ascend", aud: "ascend-web" }
   */
  async signAccessToken(userId: string, email: string): Promise<string> {
    return new SignJWT({ sub: userId, email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .setIssuer("ascend")
      .setAudience("ascend-web")
      .sign(JWT_SECRET);
  },

  /**
   * Verify an access token JWT.
   *
   * Validates signature, expiry, issuer ("ascend"), and audience ("ascend-web").
   * Returns the userId and email on success, or null on any failure (bad
   * signature, wrong issuer/audience, expired). Never throws.
   */
  async verifyAccessToken(
    token: string,
  ): Promise<{ userId: string; email: string } | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET, {
        issuer: "ascend",
        audience: "ascend-web",
      });

      const userId = payload.sub;
      const email = payload.email as string | undefined;

      if (!userId || !email) return null;

      return { userId, email };
    } catch {
      // Any jose error (expired, bad sig, wrong iss/aud) results in null
      return null;
    }
  },

  // =========================================================================
  // Refresh tokens (opaque 256-bit hex, stored as SHA-256 hash)
  // =========================================================================

  /**
   * Generate a cryptographically random 256-bit refresh token.
   * Returns 64-character hex string (the raw value sent to the client).
   */
  generateRefreshTokenRaw(): string {
    return crypto.randomBytes(32).toString("hex");
  },

  /**
   * Hash a raw refresh token with SHA-256 for storage in Session.refreshTokenHash.
   * The raw token is never stored server-side; only the hash is persisted.
   */
  hashRefreshToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
  },

  // =========================================================================
  // Sessions
  // =========================================================================

  /**
   * Create a new session (login flow).
   *
   * Generates a fresh refresh token family (new familyId), signs an access
   * token, and persists the session row with the hashed refresh token.
   */
  async createSession(
    userId: string,
    userEmail: string,
    meta: {
      userAgent?: string;
      ipAddress?: string;
      deviceName?: string;
    },
  ): Promise<{
    accessToken: string;
    refreshTokenRaw: string;
    session: Session;
  }> {
    const accessToken = await this.signAccessToken(userId, userEmail);
    const refreshTokenRaw = this.generateRefreshTokenRaw();
    const refreshTokenHash = this.hashRefreshToken(refreshTokenRaw);

    // Each login starts a new token family. All sessions in the same
    // family share a familyId so reuse detection can revoke siblings.
    const familyId = crypto.randomUUID();

    const session = await prisma.session.create({
      data: {
        userId,
        familyId,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
        deviceName: meta.deviceName ?? null,
      },
    });

    return { accessToken, refreshTokenRaw, session };
  },

  // -----------------------------------------------------------------------
  // Rotation + reuse detection pseudocode:
  //
  // 1. hash = SHA-256(presentedRefreshRaw)
  // 2. session = prisma.session.findUnique({ where: { refreshTokenHash: hash } })
  // 3. if !session -> { ok: false, error: "not_found" }
  // 4. if session.revokedAt !== null ->
  //      await revokeFamily(session.familyId)  // REUSE: was valid once, now revoked
  //      return { ok: false, error: "reuse" }
  // 5. if session.expiresAt <= now -> { ok: false, error: "expired" }
  // 6. within prisma.$transaction([...]):
  //      mark current session revokedAt = now, lastUsedAt = now
  //      create new session with SAME familyId, new hash, new expiresAt (now + 30d)
  // 7. sign new access token with the user's email (fetched from user relation)
  // 8. return { ok: true, accessToken, refreshTokenRaw, session: newRow }
  // -----------------------------------------------------------------------

  /**
   * Rotate a refresh token.
   *
   * Finds the session matching the presented token, validates it, and
   * atomically revokes the old session + creates a new one in the same
   * family. If the presented token was already revoked (reuse detection),
   * revokes the entire family.
   */
  async rotateSession(
    presentedRefreshRaw: string,
  ): Promise<
    | {
        ok: true;
        accessToken: string;
        refreshTokenRaw: string;
        session: Session;
      }
    | { ok: false; error: "expired" | "reuse" | "not_found" }
  > {
    const hash = this.hashRefreshToken(presentedRefreshRaw);

    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: hash },
    });

    if (!session) {
      return { ok: false, error: "not_found" };
    }

    // REUSE DETECTION: the token was once valid but has been revoked
    // (meaning someone already rotated it). Revoke the entire family
    // to force all devices in this family to re-authenticate.
    if (session.revokedAt !== null) {
      await this.revokeFamily(session.familyId);
      return { ok: false, error: "reuse" };
    }

    if (session.expiresAt <= new Date()) {
      return { ok: false, error: "expired" };
    }

    // Fetch the user to get the email for the new access token.
    // The user must exist because the session has a FK to User.
    const user = await userService.findById(session.userId);
    if (!user || !user.email) {
      return { ok: false, error: "not_found" };
    }

    const newRefreshTokenRaw = this.generateRefreshTokenRaw();
    const newRefreshTokenHash = this.hashRefreshToken(newRefreshTokenRaw);
    const now = new Date();

    // Atomic: revoke old session + create new session in the same family.
    // If the transaction fails (e.g., unique constraint collision on
    // refreshTokenHash, astronomically unlikely with 256-bit random), the
    // caller sees an error that the route translates to 401.
    const [, newSession] = await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: now, lastUsedAt: now },
      }),
      prisma.session.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          refreshTokenHash: newRefreshTokenHash,
          expiresAt: new Date(
            Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000,
          ),
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          deviceName: session.deviceName,
        },
      }),
    ]);

    const accessToken = await this.signAccessToken(
      user.id,
      user.email,
    );

    return {
      ok: true,
      accessToken,
      refreshTokenRaw: newRefreshTokenRaw,
      session: newSession,
    };
  },

  /**
   * Revoke a single session by ID, scoped to userId (logout flow).
   *
   * userId is required (safety rule 1: every Prisma mutation scopes by userId)
   * to prevent a future caller from passing an arbitrary sessionId and revoking
   * another user's session. The logout route derives both values from the
   * refresh token cookie (hash the raw cookie, look up the row, pass
   * row.userId + row.id here).
   *
   * updateMany is used instead of update so a mismatched userId is a silent
   * no-op rather than a throw; the logout flow treats a missing or mismatched
   * session as already-logged-out (idempotent).
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });
  },

  /**
   * Revoke all sessions in a token family (reuse detection response).
   *
   * Sets revokedAt on ALL siblings of the family that are not yet revoked.
   * This forces every device sharing the family to re-authenticate.
   */
  async revokeFamily(familyId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // =========================================================================
  // Rate limiting (in-process Map, single-node only)
  // =========================================================================

  /**
   * Check whether a login attempt is allowed for the given email.
   *
   * Prunes stale entries from the rate map on each call to prevent
   * unbounded memory growth (O(n) per call; acceptable because the Map
   * holds at most a few hundred entries under normal load).
   */
  checkLoginRateLimit(
    email: string,
  ): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const now = Date.now();

    // Prune stale entries
    for (const [key, entry] of loginRateMap) {
      if (entry.resetAt < now) {
        loginRateMap.delete(key);
      }
    }

    const entry = loginRateMap.get(email);
    if (!entry) {
      return { allowed: true };
    }

    if (entry.resetAt < now) {
      loginRateMap.delete(email);
      return { allowed: true };
    }

    if (entry.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true };
  },

  /**
   * Record a failed login attempt for rate limiting.
   */
  recordLoginFailure(email: string): void {
    const now = Date.now();
    const existing = loginRateMap.get(email);

    if (existing && existing.resetAt > now) {
      existing.attempts += 1;
    } else {
      loginRateMap.set(email, {
        attempts: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
    }
  },

  /**
   * Reset the rate limit counter for an email (called on successful login).
   * Resets immediately rather than waiting for the 15-minute window to expire.
   */
  resetLoginRateLimit(email: string): void {
    loginRateMap.delete(email);
  },

  // =========================================================================
  // Cookie helpers
  // =========================================================================

  /**
   * Build cookie options for the access_token cookie.
   * httpOnly, Secure (prod only), SameSite=Lax, path=/, maxAge=900 (15 min).
   */
  buildAccessCookieOptions(): CookieOptions {
    const opts: CookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    };

    if (process.env.COOKIE_DOMAIN) {
      opts.domain = process.env.COOKIE_DOMAIN;
    }

    return opts;
  },

  /**
   * Build cookie options for the refresh_token cookie.
   * Same flags as access, but maxAge=2592000 (30 days).
   */
  buildRefreshCookieOptions(): CookieOptions {
    const opts: CookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    };

    if (process.env.COOKIE_DOMAIN) {
      opts.domain = process.env.COOKIE_DOMAIN;
    }

    return opts;
  },

  /**
   * Build cookie options for clearing both auth cookies (logout, failed refresh).
   * Same flags as access, but maxAge=0 to delete the cookie immediately.
   */
  buildClearCookieOptions(): CookieOptions {
    const opts: CookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    };

    if (process.env.COOKIE_DOMAIN) {
      opts.domain = process.env.COOKIE_DOMAIN;
    }

    return opts;
  },

  // =========================================================================
  // Session lookup (for logout)
  // =========================================================================

  /**
   * Find a session row by the raw (unhashed) refresh token.
   *
   * Hashes the raw token via SHA-256 and looks up the unique
   * refreshTokenHash. Used by the logout route to locate the session
   * to revoke without importing prisma directly in the route (safety
   * rule 4).
   */
  async findSessionByRefreshToken(
    rawRefreshToken: string,
  ): Promise<Session | null> {
    const hash = this.hashRefreshToken(rawRefreshToken);
    return prisma.session.findUnique({ where: { refreshTokenHash: hash } });
  },

  // =========================================================================
  // Timing-safe login helper
  // =========================================================================

  /**
   * Run a dummy scrypt hash against a fixed placeholder to equalize
   * response time between "unknown email" and "wrong password" paths.
   *
   * The login handler calls this when findByEmail returns null, burning
   * the same CPU time that verifyPassword would. This prevents
   * timing-based email enumeration.
   *
   * DO NOT remove or optimize this away. A future refactor that skips it
   * re-opens the timing side channel for email enumeration.
   */
  async runDummyScryptForTimingSafety(): Promise<void> {
    await scryptAsync(DUMMY_PASSWORD_PLACEHOLDER, DUMMY_SALT, SCRYPT_KEY_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    });
  },
};
