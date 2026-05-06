import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Workspace context service
//
// Two responsibilities:
//   1. Resolve the user's default workspace ID for auth context.
//   2. Issue and verify short-lived CRDT tokens for Hocuspocus connections.
//
// The CRDT token is a separate JWT signed with CRDT_JWT_SECRET (distinct
// from AUTH_JWT_SECRET) so compromise of one secret does not cascade to
// the other. The token is scoped to a single document (entryId) and
// carries explicit permissions.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CRDT_JWT_SECRET: env check at module import time.
//
// Phase 3a does not require the CRDT server to be running, so a missing
// secret logs a warning rather than crashing the process. Phase 4 will
// enforce presence (throw on missing).
// ---------------------------------------------------------------------------
const CRDT_JWT_SECRET_RAW = process.env.CRDT_JWT_SECRET;
let CRDT_JWT_SECRET: Uint8Array | null = null;

if (!CRDT_JWT_SECRET_RAW || CRDT_JWT_SECRET_RAW.length < 32) {
  console.warn(
    "[workspace-context-service] CRDT_JWT_SECRET is not set or too short. " +
      "CRDT token issuance and verification will fail until configured. " +
      "This is expected during Phase 3a development.",
  );
} else {
  CRDT_JWT_SECRET = new TextEncoder().encode(CRDT_JWT_SECRET_RAW);
}

/** Default CRDT token TTL in seconds (5 minutes) */
const DEFAULT_CRDT_TOKEN_TTL_SECONDS = 300;

/** Custom JWT claims for the CRDT token (beyond standard JWTPayload) */
interface CrdtTokenClaims extends JWTPayload {
  sub: string; // userId
  workspaceId: string;
  entryId: string;
  permissions: Array<"read" | "write">;
}

export const workspaceContextService = {
  /**
   * Resolve the user's default workspace ID.
   *
   * Primary source: User.defaultWorkspaceId (set by Phase 1 seed migration).
   * Fallback: first workspace where the user has an ACTIVE membership.
   * If still null (should not happen post-backfill), returns null.
   */
  async resolveDefaultWorkspaceId(
    userId: string,
  ): Promise<string | null> {
    // Primary: read from User.defaultWorkspaceId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { defaultWorkspaceId: true },
    });

    if (user?.defaultWorkspaceId) {
      return user.defaultWorkspaceId;
    }

    // Fallback: find the first workspace where the user is ACTIVE
    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
      select: { workspaceId: true },
      orderBy: { createdAt: "asc" },
    });

    return membership?.workspaceId ?? null;
  },

  /**
   * Generate a short-lived JWT for Hocuspocus CRDT connections.
   *
   * The token is scoped to a single document (entryId) and workspace.
   * Hocuspocus's onAuthenticate hook verifies the token and checks that
   * the documentName matches the entryId claim.
   *
   * Token claims:
   *   - aud: "crdt" (distinguishes from auth JWTs)
   *   - sub: userId
   *   - workspaceId: the workspace the entry belongs to
   *   - entryId: the specific document
   *   - permissions: ["read", "write"] (Wave 8 always issues full perms;
   *     Wave 8b restricts for VIEWER role)
   *
   * Document name format: "blockdoc:<entryId>"
   *
   * Throws if CRDT_JWT_SECRET is not configured.
   */
  async generateCrdtToken(
    userId: string,
    workspaceId: string,
    entryId: string,
    options?: {
      ttlSeconds?: number;
      permissions?: Array<"read" | "write">;
    },
  ): Promise<{
    token: string;
    documentName: string;
    expiresAt: Date;
  }> {
    if (!CRDT_JWT_SECRET) {
      throw new Error(
        "CRDT_JWT_SECRET is not configured. Cannot issue CRDT tokens.",
      );
    }

    const ttl = options?.ttlSeconds ?? DEFAULT_CRDT_TOKEN_TTL_SECONDS;
    const permissions = options?.permissions ?? ["read", "write"];
    const documentName = `blockdoc:${entryId}`;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const token = await new SignJWT({
      sub: userId,
      workspaceId,
      entryId,
      permissions,
    } satisfies CrdtTokenClaims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${ttl}s`)
      .setAudience("crdt")
      .sign(CRDT_JWT_SECRET);

    return { token, documentName, expiresAt };
  },

  /**
   * Verify a CRDT token and extract its claims.
   *
   * Validates signature, expiry, and audience ("crdt"). Returns the
   * decoded claims on success. Throws on invalid, expired, or
   * mis-audienced tokens.
   */
  async verifyCrdtToken(token: string): Promise<{
    userId: string;
    workspaceId: string;
    entryId: string;
    permissions: Array<"read" | "write">;
  }> {
    if (!CRDT_JWT_SECRET) {
      throw new Error(
        "CRDT_JWT_SECRET is not configured. Cannot verify CRDT tokens.",
      );
    }

    const { payload } = await jwtVerify(token, CRDT_JWT_SECRET, {
      audience: "crdt",
    });

    const claims = payload as CrdtTokenClaims;

    if (!claims.sub || !claims.workspaceId || !claims.entryId) {
      throw new Error("Invalid CRDT token: missing required claims");
    }

    if (
      !Array.isArray(claims.permissions) ||
      claims.permissions.length === 0
    ) {
      throw new Error("Invalid CRDT token: missing permissions");
    }

    return {
      userId: claims.sub,
      workspaceId: claims.workspaceId,
      entryId: claims.entryId,
      permissions: claims.permissions,
    };
  },
};
