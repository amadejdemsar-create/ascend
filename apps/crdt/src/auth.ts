/**
 * CRDT server authentication hook.
 *
 * INTENTIONAL DUPLICATION: This file duplicates the JWT verification
 * logic from apps/web/lib/services/workspace-context-service.ts.
 * Both sides must agree on the same JWT structure (aud, sub, claims).
 * The CRDT app cannot import from apps/web (cross-app boundary rule).
 */

import { jwtVerify, type JWTPayload } from "jose";

// ---------------------------------------------------------------------------
// CRDT_JWT_SECRET: loaded at module init. Hard throw if missing or <32 chars
// because the CRDT server cannot function without it.
// ---------------------------------------------------------------------------

const CRDT_JWT_SECRET_RAW = process.env.CRDT_JWT_SECRET;
if (!CRDT_JWT_SECRET_RAW || CRDT_JWT_SECRET_RAW.length < 32) {
  throw new Error(
    "[crdt] CRDT_JWT_SECRET is not set or shorter than 32 characters. " +
      "The CRDT server cannot start without a valid secret.",
  );
}
const CRDT_JWT_SECRET = new TextEncoder().encode(CRDT_JWT_SECRET_RAW);

/** Custom JWT claims for the CRDT token (mirrors web app's CrdtTokenClaims) */
interface CrdtTokenClaims extends JWTPayload {
  sub: string; // userId
  workspaceId: string;
  entryId: string;
  permissions: Array<"read" | "write">;
}

/** Context type passed through Hocuspocus hooks after authentication. */
export interface CrdtContext {
  userId: string;
  workspaceId: string;
  entryId: string;
  permissions: Array<"read" | "write">;
}

/**
 * onAuthenticate hook for Hocuspocus.
 *
 * Steps:
 *   1. Verify JWT signature + expiry against CRDT_JWT_SECRET.
 *   2. Check aud === "crdt".
 *   3. Parse claims: sub (userId), workspaceId, entryId, permissions.
 *   4. Verify documentName === "blockdoc:<entryId>" (prevents cross-document
 *      token reuse, DZ-23 mitigation).
 *   5. Return context for downstream hooks.
 *
 * Throws on any invalid claim, which causes Hocuspocus to reject the
 * connection with a 403 equivalent.
 */
export async function onAuthenticate(data: {
  token: string;
  documentName: string;
}): Promise<CrdtContext> {
  const { token, documentName } = data;

  // 1 + 2: Verify JWT signature, expiry, and audience
  let claims: CrdtTokenClaims;
  try {
    const result = await jwtVerify(token, CRDT_JWT_SECRET, {
      audience: "crdt",
    });
    claims = result.payload as CrdtTokenClaims;
  } catch (err) {
    throw new Error(
      `CRDT token verification failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 3: Validate required claims
  if (!claims.sub) {
    throw new Error("Invalid CRDT token: missing sub (userId)");
  }
  if (!claims.workspaceId) {
    throw new Error("Invalid CRDT token: missing workspaceId");
  }
  if (!claims.entryId) {
    throw new Error("Invalid CRDT token: missing entryId");
  }
  if (
    !Array.isArray(claims.permissions) ||
    claims.permissions.length === 0
  ) {
    throw new Error("Invalid CRDT token: missing or empty permissions");
  }

  // 4: Document name must match the token's entryId exactly (DZ-23)
  const expectedDocumentName = `blockdoc:${claims.entryId}`;
  if (documentName !== expectedDocumentName) {
    throw new Error(
      `Document name mismatch: expected "${expectedDocumentName}", got "${documentName}". ` +
        "Cross-document token reuse is not permitted.",
    );
  }

  // 5: Return context for downstream hooks
  return {
    userId: claims.sub,
    workspaceId: claims.workspaceId,
    entryId: claims.entryId,
    permissions: claims.permissions,
  };
}
