import type { ExcalidrawScene } from "@/lib/validations";
import { excalidrawSceneSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// Canvas import service (Wave 9)
//
// Pure parse + validation. No DB writes; callers are responsible for
// applying the parsed scene to a CanvasLayout via canvasLayoutService.
//
// .tldr import was dropped from W9 scope (Phase 0 spike): no maintained
// standalone parser exists, and the real parser ships inside the
// proprietary tldraw SDK. Routes that accept format="tldr" should
// 400 with a clear "not supported" message.
// ---------------------------------------------------------------------------

const IMPORT_FILE_MAX_BYTES = 4 * 1024 * 1024; // 4 MiB pre-parse cap
const IMPORT_ELEMENT_COUNT_MAX = 5000;

/**
 * Parse a `.excalidraw` file buffer into an ExcalidrawScene.
 *
 * Validates:
 *   - Buffer size below the 4 MiB pre-parse cap (defense in depth on
 *     top of the route-level 100 MiB multipart cap).
 *   - The decoded JSON has a `type === "excalidraw"` envelope field
 *     when present (older Excalidraw exports omit it; we accept both).
 *   - Element count below the 5000 cap.
 *   - The shape conforms to `excalidrawSceneSchema` (loose envelope:
 *     elements: Array<unknown record>, appState: unknown record,
 *     files?: unknown record).
 *
 * Throws structured Error on any failure.
 */
export const canvasImportService = {
  parseExcalidrawFile(buffer: Buffer | Uint8Array): ExcalidrawScene {
    if (buffer.byteLength > IMPORT_FILE_MAX_BYTES) {
      throw new Error(
        `Excalidraw file exceeds 4 MiB pre-parse cap (${buffer.byteLength} bytes).`,
      );
    }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new Error(
        `Excalidraw file is not valid JSON: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    if (typeof json !== "object" || json === null) {
      throw new Error("Excalidraw file did not parse to a JSON object.");
    }

    const envelope = json as Record<string, unknown>;

    // Excalidraw exports include `type: "excalidraw"` since at least v0.10.
    // Tolerate older files that omit it; reject mismatched types.
    if (
      envelope.type !== undefined &&
      envelope.type !== "excalidraw" &&
      envelope.type !== "excalidrawClipboard"
    ) {
      throw new Error(
        `Unexpected Excalidraw envelope type: "${String(envelope.type)}". Expected "excalidraw".`,
      );
    }

    // Element count cap (cheap to check before full Zod parse).
    if (Array.isArray(envelope.elements)) {
      if (envelope.elements.length > IMPORT_ELEMENT_COUNT_MAX) {
        throw new Error(
          `Excalidraw scene has ${envelope.elements.length} elements; cap is ${IMPORT_ELEMENT_COUNT_MAX}.`,
        );
      }
    }

    // Normalize and validate the scene envelope. We extract just the
    // three fields the canvas layout cares about and discard the rest
    // (Excalidraw export includes version, source, etc. that are
    // metadata-only).
    const scene: Record<string, unknown> = {
      elements: Array.isArray(envelope.elements) ? envelope.elements : [],
      appState:
        typeof envelope.appState === "object" && envelope.appState !== null
          ? envelope.appState
          : {},
    };
    if (
      typeof envelope.files === "object" &&
      envelope.files !== null
    ) {
      scene.files = envelope.files;
    }

    const result = excalidrawSceneSchema.safeParse(scene);
    if (!result.success) {
      throw new Error(
        `Excalidraw scene failed validation: ${result.error.message}`,
      );
    }
    return result.data;
  },

  /**
   * Merge two Excalidraw scenes. Elements are concatenated; later
   * elements override earlier ones with the same id (Excalidraw uses
   * string ids on every element). appState is shallow-merged (incoming
   * wins). files are object-merged (incoming wins).
   *
   * Returns a new scene; does not mutate inputs.
   */
  mergeScenes(base: ExcalidrawScene, incoming: ExcalidrawScene): ExcalidrawScene {
    const elementsById = new Map<string, Record<string, unknown>>();
    for (const el of base.elements) {
      const elObj = el as Record<string, unknown>;
      const id = typeof elObj.id === "string" ? elObj.id : null;
      if (id) elementsById.set(id, elObj);
    }
    for (const el of incoming.elements) {
      const elObj = el as Record<string, unknown>;
      const id = typeof elObj.id === "string" ? elObj.id : null;
      if (id) {
        elementsById.set(id, elObj);
      } else {
        // No id: append.
        elementsById.set(`__noid_${Math.random().toString(36).slice(2)}`, elObj);
      }
    }
    const mergedElements = Array.from(elementsById.values());

    const mergedScene: ExcalidrawScene = {
      elements: mergedElements,
      appState: {
        ...base.appState,
        ...incoming.appState,
      },
    };
    if (base.files || incoming.files) {
      mergedScene.files = {
        ...(base.files ?? {}),
        ...(incoming.files ?? {}),
      };
    }
    return mergedScene;
  },
};
