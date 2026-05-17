/**
 * Wave 10: Zod schemas for embeddable external data (GitHub adapter
 * is the only concrete provider in W10).
 *
 * The schemas split into three groups:
 *   1. Source-level CRUD (`createExternalSourceSchema`, etc.) — covers
 *      authentication + per-provider config.
 *   2. Query input (`externalDataQuerySchema`) — pagination + filter
 *      + sort applied at the adapter boundary.
 *   3. Provider-specific config (`githubConfigSchema`) — the JSON shape
 *      stored in `ExternalDataSource.config`.
 *
 * Adapters consume the output shapes (`ExternalDataField`,
 * `ExternalDataRow`) defined in `../types/external-data.ts`.
 */

import { z } from "zod";

// ── Enums (mirror Prisma) ───────────────────────────────────────────

export const EXTERNAL_DATA_PROVIDER_VALUES = ["GITHUB"] as const;
export type ExternalDataProvider =
  (typeof EXTERNAL_DATA_PROVIDER_VALUES)[number];
export const externalDataProviderSchema = z.enum(EXTERNAL_DATA_PROVIDER_VALUES);

export const EXTERNAL_DATA_AUTH_TYPE_VALUES = ["PAT"] as const;
export type ExternalDataAuthType =
  (typeof EXTERNAL_DATA_AUTH_TYPE_VALUES)[number];
export const externalDataAuthTypeSchema = z.enum(EXTERNAL_DATA_AUTH_TYPE_VALUES);

// ── Field constraints ───────────────────────────────────────────────

export const EXTERNAL_SOURCE_NAME_MIN = 1;
export const EXTERNAL_SOURCE_NAME_MAX = 100;
export const EXTERNAL_SOURCE_CREDENTIALS_MAX = 2048;

// ── GitHub-specific config ──────────────────────────────────────────

/**
 * Scope determines which repos the adapter pulls from:
 *   - "user": all repos accessible to the authenticated user (incl. private
 *     if the PAT has the `repo` scope).
 *   - "org": only repos under a specific organization.
 * Optionally narrowed by `repoFilter` (include/exclude patterns matched
 * against the repo's `full_name`, `owner/repo` form, glob-style).
 */
export const githubScopeSchema = z.enum(["user", "org"]);
export type GithubScope = z.infer<typeof githubScopeSchema>;

export const githubRepoFilterSchema = z.object({
  include: z.array(z.string().min(1).max(255)).max(50).default([]),
  exclude: z.array(z.string().min(1).max(255)).max(50).default([]),
});
export type GithubRepoFilter = z.infer<typeof githubRepoFilterSchema>;

/**
 * GitHub-specific config persisted in `ExternalDataSource.config`.
 * Cached shape schemas (per Issue/PR/etc.) live under `shapeSchemas`
 * keyed by the shape id.
 */
export const githubConfigSchema = z.object({
  scope: githubScopeSchema,
  orgSlug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/, "Invalid GitHub org slug")
    .optional(),
  repoFilter: githubRepoFilterSchema.optional(),
  /**
   * Per-shape schemas refreshed on demand. The key is the shape id
   * (e.g., "issues", "pulls", "repos"); the value is the
   * `ExternalDataField[]` JSON. Capped overall at 16 KiB by the DB
   * CHECK on `config`.
   */
  shapeSchemas: z.record(z.string(), z.unknown()).optional(),
});
export type GithubConfig = z.infer<typeof githubConfigSchema>;

// ── Source CRUD ─────────────────────────────────────────────────────

export const createExternalSourceSchema = z
  .object({
    provider: externalDataProviderSchema,
    name: z
      .string()
      .min(EXTERNAL_SOURCE_NAME_MIN, "Name is required")
      .max(EXTERNAL_SOURCE_NAME_MAX),
    authType: externalDataAuthTypeSchema.default("PAT"),
    /**
     * Credentials in plaintext on the wire. Service encrypts via
     * secretsService before persistence.
     */
    credentials: z
      .string()
      .min(1, "Credentials are required")
      .max(EXTERNAL_SOURCE_CREDENTIALS_MAX),
    /** Provider-specific config; validated by per-provider schema in the service. */
    config: z.unknown(),
    enabled: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.provider === "GITHUB") {
      const parsed = githubConfigSchema.safeParse(data.config);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["config"],
          message: `Invalid GitHub config: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
        });
      }
    }
  });
export type CreateExternalSourceInput = z.infer<typeof createExternalSourceSchema>;

export const updateExternalSourceSchema = z
  .object({
    name: z
      .string()
      .min(EXTERNAL_SOURCE_NAME_MIN)
      .max(EXTERNAL_SOURCE_NAME_MAX)
      .optional(),
    credentials: z
      .string()
      .min(1)
      .max(EXTERNAL_SOURCE_CREDENTIALS_MAX)
      .optional(),
    config: z.unknown().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();
export type UpdateExternalSourceInput = z.infer<typeof updateExternalSourceSchema>;

// ── Query input ─────────────────────────────────────────────────────

/**
 * Single filter clause: `field op value`. Mirrors the Wave 5
 * `filterSchema` shape but trimmed to what an external adapter can
 * actually pushdown (no nested AND/OR groups in W10; the UI will fall
 * back to AND of clauses).
 */
export const externalFilterOpSchema = z.enum([
  "eq",
  "ne",
  "in",
  "notIn",
  "contains",
  "startsWith",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "isEmpty",
  "isNotEmpty",
]);
export type ExternalFilterOp = z.infer<typeof externalFilterOpSchema>;

export const externalFilterClauseSchema = z.object({
  field: z.string().min(1).max(100),
  op: externalFilterOpSchema,
  value: z.unknown().optional(),
});
export type ExternalFilterClause = z.infer<typeof externalFilterClauseSchema>;

export const externalSortItemSchema = z.object({
  field: z.string().min(1).max(100),
  direction: z.enum(["asc", "desc"]),
});
export type ExternalSortItem = z.infer<typeof externalSortItemSchema>;

export const externalDataQuerySchema = z.object({
  shape: z.string().min(1).max(100), // e.g., "issues", "pulls"
  filter: z.array(externalFilterClauseSchema).max(20).optional(),
  sort: z.array(externalSortItemSchema).max(5).optional(),
  /** Adapter-provided opaque cursor for pagination. */
  cursor: z.string().max(2000).optional(),
  perPage: z.number().int().min(1).max(100).default(25),
});
export type ExternalDataQueryInput = z.infer<typeof externalDataQuerySchema>;
