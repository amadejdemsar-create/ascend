/**
 * Wave 10: Types for embeddable external data.
 *
 * Adapters (e.g., github-adapter.ts in apps/web) implement this
 * interface to surface external rows as Wave 5-style database rows.
 * Read-only in W10.
 *
 * The types are pure TypeScript — no Zod runtime, no React, no Prisma.
 * Safe to import from any layer, including the mobile app once it lands.
 */

/**
 * One "virtual table" an external source can expose. A GitHub source
 * has shapes "issues", "pulls", "repos"; a Linear source would have
 * "issues", "projects", etc.
 */
export interface ExternalDataShape {
  id: string;
  label: string;
  /** Human-friendly description shown in the source's detail view. */
  description?: string;
}

/**
 * One field (column) on a shape. Maps to a Wave 5 `DatabaseFieldType`
 * subset that adapters can produce. `RELATION` and `FORMULA` are
 * intentionally excluded: external rows do not link via Wave 5
 * relations, and formulas are computed only by the local engine.
 */
export type ExternalDataFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "MULTI_SELECT"
  | "URL"
  | "EMAIL"
  | "USER"
  | "CHECKBOX";

export interface ExternalDataField {
  id: string;
  label: string;
  type: ExternalDataFieldType;
  /** SELECT and MULTI_SELECT options. Empty for other types. */
  options?: Array<{ value: string; label: string; color?: string }>;
  /** True when this is the row's primary text field (the title shown in cards/lists). */
  isPrimary?: boolean;
  /** Whether the adapter can pushdown filters on this field server-side. */
  filterable?: boolean;
  /** Whether the adapter can pushdown sort on this field server-side. */
  sortable?: boolean;
  /**
   * Whether this field's plaintext should feed the local full-text
   * search index (text-only; semantic embedding is W11+).
   */
  searchable?: boolean;
}

/**
 * A single row returned by an adapter query. `remoteId` is the
 * upstream's stable identifier (e.g., GitHub issue node_id). `data`
 * is keyed by `ExternalDataField.id`.
 */
export interface ExternalDataRow {
  remoteId: string;
  /** Deep-link to the canonical upstream page (e.g., GitHub html_url). */
  htmlUrl?: string;
  /** Adapter-fetched values, keyed by ExternalDataField.id. */
  data: Record<string, unknown>;
  /** Optional upstream timestamps for sort/filter ergonomics. */
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Cursor-paginated query result. `nextCursor` is opaque to the caller
 * and only meaningful to the same adapter.
 */
export interface ExternalDataQueryResult {
  rows: ExternalDataRow[];
  nextCursor: string | null;
  totalCount?: number;
  /** True when the upstream rate-limited the request. Adapter should also surface a friendly error in lastListError. */
  rateLimited?: boolean;
}

/**
 * Adapter interface. The service layer instantiates one per
 * `ExternalDataSource` (passing the decrypted PAT + config).
 *
 * All methods MUST be safe to call from a serverless runtime
 * (no module state, no long-lived sockets). Use `globalThis.fetch`.
 */
export interface ExternalDataAdapter {
  /** List the virtual tables this source exposes. */
  listShapes(): ExternalDataShape[];

  /**
   * Return the schema for a shape. Adapters may include cached
   * options (e.g., GitHub labels) here.
   */
  getSchema(shape: string): Promise<ExternalDataField[]>;

  /**
   * Query rows. Adapters do their best to pushdown filter+sort server-
   * side; whatever they can't, they ignore (the service falls back to
   * client-side filtering as a layer above).
   */
  query(
    shape: string,
    args: {
      filter?: Array<{ field: string; op: string; value?: unknown }>;
      sort?: Array<{ field: string; direction: "asc" | "desc" }>;
      cursor?: string;
      perPage?: number;
    },
  ): Promise<ExternalDataQueryResult>;

  /** Fetch a single row by remoteId. Used by wikilink resolution. */
  getRow(shape: string, remoteId: string): Promise<ExternalDataRow | null>;
}

/**
 * Virtual entry ID format for wikilinks that resolve to an external row.
 * Format: `ext:<sourceId>:<shape>:<remoteId>`. Used in
 * `ContextLink.toEntryId` (DZ-29).
 */
export const EXTERNAL_VIRTUAL_ID_PREFIX = "ext:";

export function makeVirtualExternalEntryId(
  sourceId: string,
  shape: string,
  remoteId: string,
): string {
  return `${EXTERNAL_VIRTUAL_ID_PREFIX}${sourceId}:${shape}:${remoteId}`;
}

export function parseVirtualExternalEntryId(id: string): {
  sourceId: string;
  shape: string;
  remoteId: string;
} | null {
  if (!id.startsWith(EXTERNAL_VIRTUAL_ID_PREFIX)) return null;
  const rest = id.slice(EXTERNAL_VIRTUAL_ID_PREFIX.length);
  const parts = rest.split(":");
  if (parts.length < 3) return null;
  // remoteId may contain colons (rare but possible); join the tail back.
  const [sourceId, shape, ...remoteParts] = parts;
  if (!sourceId || !shape || remoteParts.length === 0) return null;
  return { sourceId, shape, remoteId: remoteParts.join(":") };
}

export function isVirtualExternalEntryId(id: string): boolean {
  return id.startsWith(EXTERNAL_VIRTUAL_ID_PREFIX);
}
