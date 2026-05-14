import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { canvasLayoutService } from "@/lib/services/canvas-layout-service";
import { canvasImportService } from "@/lib/services/canvas-import-service";
import { canvasImportBodySchema } from "@/lib/validations";

/**
 * POST /api/canvas/import
 *
 * Imports an Excalidraw scene into an existing CanvasLayout. The
 * client parses the .excalidraw file (which is already JSON) and
 * POSTs the parsed scene; the server re-validates the envelope,
 * optionally merges with the existing canvas, and persists via
 * canvasLayoutService.update.
 *
 * .tldr was dropped from Wave 9 scope (Phase 0 spike). Only
 * format: "excalidraw" is accepted.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const input = canvasImportBodySchema.parse(body);

    if (input.format !== "excalidraw") {
      return NextResponse.json(
        {
          error:
            "Only .excalidraw is supported. .tldr import was dropped in Wave 9 (no maintained standalone parser).",
        },
        { status: 400 },
      );
    }

    // Re-validate the scene shape server-side (in case the client lied).
    // canvasImportService.parseExcalidrawFile parses from a buffer; for
    // a pre-parsed JSON payload we just re-run the Zod schema via the
    // import body, which already validated. The size cap is enforced
    // by the upstream canvasLayoutService.update pre-flight (2 MiB).

    let nextCanvas = input.scene;

    if (input.mode === "merge") {
      const existing = await canvasLayoutService.getById(
        auth.userId,
        auth.workspaceId,
        input.layoutId,
      );
      if (!existing) {
        return NextResponse.json(
          { error: "Canvas layout not found" },
          { status: 404 },
        );
      }
      // existing.canvas is JSONB; service returns it as Prisma JSON.
      // Cast through unknown because the Excalidraw scene shape is
      // validated at write time and stored as opaque JSONB.
      const baseScene = canvasImportService.parseExcalidrawFile(
        Buffer.from(JSON.stringify(existing.canvas)),
      );
      nextCanvas = canvasImportService.mergeScenes(baseScene, input.scene);
    }

    const layout = await canvasLayoutService.update(
      auth.userId,
      auth.workspaceId,
      input.layoutId,
      { canvas: nextCanvas },
    );

    return NextResponse.json({ layout, warnings: [] });
  } catch (error) {
    return handleApiError(error);
  }
}
