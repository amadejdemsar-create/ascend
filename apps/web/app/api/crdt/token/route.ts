import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { crdtTokenRequestSchema } from "@/lib/validations";
import { blockDocumentService } from "@/lib/services/block-document-service";
import { workspaceContextService } from "@/lib/services/workspace-context-service";
import { crdtRateLimit } from "@/lib/services/crdt-rate-limit-service";

export const maxDuration = 15;

/**
 * POST /api/crdt/token
 *
 * Issues a short-lived JWT for a Hocuspocus CRDT WebSocket connection.
 *
 * Auth: three-path (cookie JWT, Bearer JWT, Bearer API key).
 * Body: { entryId: string }
 *
 * Steps:
 *   1. Authenticate the user (returns userId + workspaceId).
 *   2. Validate request body via Zod.
 *   3. Verify the user can write the entry's BlockDocument.
 *   4. Generate a CRDT token scoped to the entry + workspace.
 *   5. Return { token, wsUrl, documentName, expiresAt }.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  // Rate limiting: 60 token requests per user per minute
  const rateCheck = crdtRateLimit.check(auth.userId);
  if (!rateCheck.allowed) {
    const retryAfterSeconds = Math.ceil(rateCheck.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Too many token requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    );
  }

  try {
    const body = await request.json();
    const { entryId } = crdtTokenRequestSchema.parse(body);

    // Verify the user can write this entry's BlockDocument
    await blockDocumentService.assertCanEditBlockDocument(
      auth.userId,
      auth.workspaceId,
      entryId,
    );

    // Generate a CRDT token scoped to this document. Misconfiguration of
    // CRDT_JWT_SECRET surfaces as an unconfigured-service 503 instead of
    // leaking the env var name through handleApiError (DZ-23 hardening).
    let token: string;
    let documentName: string;
    let expiresAt: Date;
    try {
      const result = await workspaceContextService.generateCrdtToken(
        auth.userId,
        auth.workspaceId,
        entryId,
      );
      token = result.token;
      documentName = result.documentName;
      expiresAt = result.expiresAt;
    } catch (err) {
      console.error("[crdt/token] token issuance failed:", err);
      return NextResponse.json(
        { error: "CRDT service temporarily unavailable" },
        { status: 503 },
      );
    }

    // Resolve the WebSocket URL for the CRDT server. Production must set
    // CRDT_WS_URL; missing it in production is a misconfiguration we
    // refuse to paper over with a localhost fallback.
    const wsUrl = process.env.CRDT_WS_URL;
    if (!wsUrl) {
      if (process.env.NODE_ENV === "production") {
        console.error(
          "[crdt/token] CRDT_WS_URL is required in production but is not set.",
        );
        return NextResponse.json(
          { error: "CRDT service temporarily unavailable" },
          { status: 503 },
        );
      }
      console.warn(
        "[crdt/token] CRDT_WS_URL is not set; falling back to ws://localhost:1234.",
      );
    }
    const resolvedWsUrl = wsUrl ?? "ws://localhost:1234";

    // Record the successful token issuance for rate limiting
    crdtRateLimit.record(auth.userId);

    return NextResponse.json({
      token,
      wsUrl: resolvedWsUrl,
      documentName,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
