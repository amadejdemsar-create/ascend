/**
 * Canvas MCP Tool Handlers (Wave 9 Phase 9).
 *
 * 3 tools exposing the spatial canvas surface to AI agents:
 *   get_canvas_layout, set_node_position, create_annotation.
 *
 * Each handler validates args via Zod, calls the service layer, and returns
 * McpContent. userId + workspaceId come from createAscendMcpServer(...);
 * agents cannot override either via args.
 */

import { ZodError } from "zod";
import { canvasLayoutService } from "@/lib/services/canvas-layout-service";
import { canvasNodeService } from "@/lib/services/canvas-node-service";
import {
  getCanvasLayoutQuerySchema,
  setNodePositionSchema,
  createAnnotationSchema,
  type AnnotationKind,
  type AnnotationGeometry,
} from "@/lib/validations";

// ── Types ────────────────────────────────────────────────────────────

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(result: unknown): McpContent {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

function fail(message: string): McpContent {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// ── Annotation element factory ───────────────────────────────────────

let annotationSeedCounter = 3_000_000;

interface SceneElement {
  id: string;
  type: string;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

function buildAnnotationElement(
  kind: AnnotationKind,
  geometry: AnnotationGeometry,
  content?: string,
): SceneElement {
  const seed = annotationSeedCounter++;
  const id = `annot-${seed}`;
  const base = {
    id,
    angle: 0,
    strokeColor: kind === "sticky" ? "#fbbf24" : "#1e293b",
    backgroundColor: kind === "sticky" ? "#fef3c7" : "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null as null,
    seed,
    versionNonce: seed,
    isDeleted: false,
    boundElements: null as null,
    updated: Date.now(),
    link: null as null,
    locked: false,
    customData: { kind: "annotation" as const },
  };

  switch (kind) {
    case "freehand": {
      const points = geometry.points ?? [
        { x: 0, y: 0 },
        { x: geometry.w ?? 50, y: geometry.h ?? 50 },
      ];
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      return {
        ...base,
        type: "freedraw",
        x: geometry.x,
        y: geometry.y,
        width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
        height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
        points: points.map((p) => [p.x, p.y]),
        pressures: points.map(() => 1),
        simulatePressure: false,
        lastCommittedPoint: null,
      };
    }
    case "rectangle":
      return {
        ...base,
        type: "rectangle",
        x: geometry.x,
        y: geometry.y,
        width: geometry.w ?? 120,
        height: geometry.h ?? 80,
        roundness: { type: 3 },
      };
    case "ellipse":
      return {
        ...base,
        type: "ellipse",
        x: geometry.x,
        y: geometry.y,
        width: geometry.w ?? 120,
        height: geometry.h ?? 80,
      };
    case "text":
      return {
        ...base,
        type: "text",
        x: geometry.x,
        y: geometry.y,
        width: geometry.w ?? Math.max(100, (content?.length ?? 0) * 9),
        height: geometry.h ?? 24,
        text: content ?? "Note",
        fontSize: 20,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        baseline: 18,
      };
    case "sticky":
      // Sticky = yellow filled rectangle + an embedded text element.
      // For simplicity we render it as a single rectangle whose
      // customData carries the text so renderers can display it.
      return {
        ...base,
        type: "rectangle",
        x: geometry.x,
        y: geometry.y,
        width: geometry.w ?? 160,
        height: geometry.h ?? 120,
        roundness: { type: 3 },
        customData: { kind: "annotation", note: content ?? "" },
      };
    case "frame":
      return {
        ...base,
        type: "frame",
        x: geometry.x,
        y: geometry.y,
        width: geometry.w ?? 320,
        height: geometry.h ?? 200,
        name: content ?? "Frame",
        strokeColor: "#94a3b8",
      };
  }
}

// ── Handler ──────────────────────────────────────────────────────────

export async function handleCanvasTool(
  userId: string,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "get_canvas_layout": {
        const data = getCanvasLayoutQuerySchema.parse(args);
        const layout = data.layoutId
          ? await canvasLayoutService.getById(
              userId,
              workspaceId,
              data.layoutId,
            )
          : await canvasLayoutService.getDefault(userId, workspaceId);
        if (!layout) {
          return fail("Canvas layout not found.");
        }
        return ok({
          layout: {
            id: layout.id,
            name: layout.name,
            slug: layout.slug,
            isDefault: layout.isDefault,
            viewport: layout.viewport,
            canvas: layout.canvas,
            createdAt: layout.createdAt,
            updatedAt: layout.updatedAt,
          },
          nodes: layout.nodes,
        });
      }

      case "set_node_position": {
        const data = setNodePositionSchema.parse(args);
        const w = data.w ?? 240;
        const h = data.h ?? 140;
        // Stable element id (matches the client-side makeCardElementId
        // convention so the rectangle in the scene blob can be located).
        const excalidrawElementId = `card-${data.contextEntryId}`;

        // 1) Upsert the CanvasNode position.
        const node = await canvasNodeService.upsert(
          userId,
          workspaceId,
          data.layoutId,
          {
            contextEntryId: data.contextEntryId,
            x: data.x,
            y: data.y,
            w,
            h,
            excalidrawElementId,
          },
        );

        // 2) Patch the rectangle in the canvas blob so the next browser
        //    render shows the card at the new position. If the rect
        //    doesn't exist yet (agent moved a card before the client
        //    ever rendered it), append one.
        const layout = await canvasLayoutService.getById(
          userId,
          workspaceId,
          data.layoutId,
        );
        if (layout) {
          const scene = (layout.canvas as {
            elements?: unknown[];
            appState?: unknown;
            files?: unknown;
          }) ?? { elements: [], appState: {} };
          const elements = Array.isArray(scene.elements)
            ? (scene.elements as SceneElement[])
            : [];
          let found = false;
          const next = elements.map((el) => {
            if (el.id === excalidrawElementId) {
              found = true;
              return {
                ...el,
                x: data.x,
                y: data.y,
                width: w,
                height: h,
                updated: Date.now(),
              };
            }
            return el;
          });
          if (!found) {
            // Synthesize the rect so the client renders something.
            next.push({
              id: excalidrawElementId,
              type: "rectangle",
              x: data.x,
              y: data.y,
              width: w,
              height: h,
              angle: 0,
              strokeColor: "transparent",
              backgroundColor: "transparent",
              fillStyle: "solid",
              strokeWidth: 1,
              strokeStyle: "solid",
              roundness: { type: 3 },
              roughness: 0,
              opacity: 100,
              groupIds: [],
              frameId: null,
              seed: annotationSeedCounter++,
              versionNonce: annotationSeedCounter,
              isDeleted: false,
              boundElements: null,
              updated: Date.now(),
              link: null,
              locked: true,
              customData: {
                kind: "node-card",
                contextEntryId: data.contextEntryId,
              },
            } as SceneElement);
          }
          await canvasLayoutService.update(
            userId,
            workspaceId,
            data.layoutId,
            {
              canvas: {
                elements: next as never,
                appState: (scene.appState ?? {}) as never,
                files: scene.files as never,
              },
            },
          );
        }

        return ok({ node });
      }

      case "create_annotation": {
        const data = createAnnotationSchema.parse(args);
        const layout = await canvasLayoutService.getById(
          userId,
          workspaceId,
          data.layoutId,
        );
        if (!layout) {
          return fail("Canvas layout not found.");
        }
        const element = buildAnnotationElement(
          data.kind,
          data.geometry,
          data.content,
        );
        const scene = (layout.canvas as {
          elements?: unknown[];
          appState?: unknown;
          files?: unknown;
        }) ?? { elements: [], appState: {} };
        const elements = Array.isArray(scene.elements)
          ? (scene.elements as unknown[])
          : [];
        const next = [...elements, element];
        await canvasLayoutService.update(
          userId,
          workspaceId,
          data.layoutId,
          {
            canvas: {
              elements: next as never,
              appState: (scene.appState ?? {}) as never,
              files: scene.files as never,
            },
          },
        );
        return ok({ elementId: element.id, kind: data.kind });
      }

      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        content: [
          { type: "text", text: `Validation error: ${error.message}` },
        ],
        isError: true,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return fail(message);
  }
}
