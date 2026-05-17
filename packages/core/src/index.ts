/**
 * @ascend/core
 *
 * Platform-agnostic schemas, enums, and constants for the Ascend ecosystem.
 * No React, Next.js, Prisma, or DOM dependencies.
 */

export * from "./schemas/index";
export * from "./constants/index";
export { parseWikilinks } from "./wikilink";
export type { ParsedWikilink } from "./wikilink";

// Wave 10 types (no Zod runtime; pure TypeScript)
export type {
  ExternalDataShape,
  ExternalDataFieldType,
  ExternalDataField,
  ExternalDataRow,
  ExternalDataQueryResult,
  ExternalDataAdapter,
} from "./types/external-data";
export {
  EXTERNAL_VIRTUAL_ID_PREFIX,
  makeVirtualExternalEntryId,
  parseVirtualExternalEntryId,
  isVirtualExternalEntryId,
} from "./types/external-data";
