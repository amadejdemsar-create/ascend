/**
 * Wave 10: Zod schemas for MCP federation.
 *
 * Three Zod surfaces:
 *   - CreateMcpConnectionInput  (POST /api/mcp-servers)
 *   - UpdateMcpConnectionInput  (PATCH /api/mcp-servers/[id])
 *   - TestMcpConnectionInput    (POST /api/mcp-servers/[id]/test)
 *
 * Plus enum re-exports for transport + auth type so callers can refer
 * to the Prisma enum values without importing Prisma types directly.
 */

import { z } from "zod";

// ── Enums (mirror Prisma) ───────────────────────────────────────────

export const MCP_SERVER_TRANSPORT_VALUES = [
  "HTTP_STREAMABLE",
  "SSE",
] as const;
export type McpServerTransport = (typeof MCP_SERVER_TRANSPORT_VALUES)[number];
export const mcpServerTransportSchema = z.enum(MCP_SERVER_TRANSPORT_VALUES);

export const MCP_SERVER_AUTH_TYPE_VALUES = [
  "NONE",
  "API_KEY",
  "BEARER",
] as const;
export type McpServerAuthType = (typeof MCP_SERVER_AUTH_TYPE_VALUES)[number];
export const mcpServerAuthTypeSchema = z.enum(MCP_SERVER_AUTH_TYPE_VALUES);

// ── Field constraints ───────────────────────────────────────────────

export const MCP_CONNECTION_NAME_MIN = 1;
export const MCP_CONNECTION_NAME_MAX = 50;
export const MCP_CONNECTION_SLUG_MIN = 1;
export const MCP_CONNECTION_SLUG_MAX = 30;
export const MCP_CONNECTION_ENDPOINT_MIN = 1;
export const MCP_CONNECTION_ENDPOINT_MAX = 2000;
export const MCP_CONNECTION_CREDENTIALS_MAX = 2048; // plaintext input cap; ciphertext is 4096

/**
 * Slug is the tool prefix in the federated `<slug>__<toolName>` form.
 * Must be lowercase kebab-case so it round-trips through URLs and tool
 * registries without escaping.
 */
export const MCP_CONNECTION_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// ── Input schemas ───────────────────────────────────────────────────

export const createMcpConnectionSchema = z
  .object({
    name: z
      .string()
      .min(MCP_CONNECTION_NAME_MIN, "Name is required")
      .max(MCP_CONNECTION_NAME_MAX),
    /**
     * Slug is OPTIONAL on create: if absent, the service derives it
     * from the name (lowercase + kebab + dedupe on collision).
     */
    slug: z
      .string()
      .min(MCP_CONNECTION_SLUG_MIN)
      .max(MCP_CONNECTION_SLUG_MAX)
      .regex(MCP_CONNECTION_SLUG_PATTERN, "Slug must be kebab-case [a-z0-9-]")
      .optional(),
    transport: mcpServerTransportSchema.default("HTTP_STREAMABLE"),
    endpoint: z
      .string()
      .url("Endpoint must be a valid URL")
      .min(MCP_CONNECTION_ENDPOINT_MIN)
      .max(MCP_CONNECTION_ENDPOINT_MAX),
    authType: mcpServerAuthTypeSchema.default("NONE"),
    /**
     * Credentials are plaintext on the wire (between the client and
     * the API route). The service encrypts via secretsService before
     * persistence. Empty/undefined when authType is NONE.
     */
    credentials: z
      .string()
      .min(1)
      .max(MCP_CONNECTION_CREDENTIALS_MAX)
      .optional(),
    enabled: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.authType !== "NONE" && !data.credentials) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credentials"],
        message:
          "Credentials are required when authType is API_KEY or BEARER",
      });
    }
    if (data.authType === "NONE" && data.credentials) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credentials"],
        message: "Credentials must be empty when authType is NONE",
      });
    }
  });
export type CreateMcpConnectionInput = z.infer<typeof createMcpConnectionSchema>;

export const updateMcpConnectionSchema = z
  .object({
    name: z.string().min(MCP_CONNECTION_NAME_MIN).max(MCP_CONNECTION_NAME_MAX).optional(),
    slug: z
      .string()
      .min(MCP_CONNECTION_SLUG_MIN)
      .max(MCP_CONNECTION_SLUG_MAX)
      .regex(MCP_CONNECTION_SLUG_PATTERN)
      .optional(),
    transport: mcpServerTransportSchema.optional(),
    endpoint: z
      .string()
      .url()
      .min(MCP_CONNECTION_ENDPOINT_MIN)
      .max(MCP_CONNECTION_ENDPOINT_MAX)
      .optional(),
    authType: mcpServerAuthTypeSchema.optional(),
    /**
     * Empty credentials on update means "leave existing ciphertext
     * untouched." If the client wants to clear credentials, they must
     * set authType to NONE in the same request.
     */
    credentials: z.string().min(1).max(MCP_CONNECTION_CREDENTIALS_MAX).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();
export type UpdateMcpConnectionInput = z.infer<typeof updateMcpConnectionSchema>;

/**
 * Test endpoint takes no body; the connection id comes from the URL.
 * Kept as an explicit empty schema for parity + future expansion.
 */
export const testMcpConnectionSchema = z.object({}).strict();
export type TestMcpConnectionInput = z.infer<typeof testMcpConnectionSchema>;
