/**
 * Spreadsheet extraction handler.
 *
 * Supports CSV (via papaparse) and XLSX/XLS/ODS (via xlsx/SheetJS).
 * Serializes rows as "row 1: a, b, c\nrow 2: d, e, f" for plain-text
 * indexing. Caps at the first 1000 rows to prevent excessive output.
 */

import type { ExtractionResult, ExtractionHandlerOpts } from "./types";
import Papa from "papaparse";
import * as XLSX from "xlsx";

/** Maximum rows to extract. */
const MAX_ROWS = 1000;

// ── MIME type sniffing ──────────────────────────────────────────

const CSV_MIMES = new Set([
  "text/csv",
  "text/tab-separated-values",
  "application/csv",
]);

const XLSX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

// ── Handler ─────────────────────────────────────────────────────

export async function extractSpreadsheet(
  buffer: Buffer,
  mimeType: string,
  _opts?: ExtractionHandlerOpts,
): Promise<ExtractionResult> {
  let rows: unknown[][];

  if (CSV_MIMES.has(mimeType)) {
    rows = parseCsv(buffer.toString("utf-8"));
  } else if (XLSX_MIMES.has(mimeType)) {
    rows = parseXlsx(buffer);
  } else {
    // Fallback: try XLSX parser (handles many binary spreadsheet formats)
    rows = parseXlsx(buffer);
  }

  // Cap at MAX_ROWS
  const cappedRows = rows.slice(0, MAX_ROWS);

  // Serialize to "row N: a, b, c" format
  const text = cappedRows
    .map((row, i) => {
      const cells = row.map((cell) => formatCell(cell)).join(", ");
      return `row ${i + 1}: ${cells}`;
    })
    .join("\n");

  return {
    text,
    pageCount: rows.length > MAX_ROWS ? MAX_ROWS : rows.length,
  };
}

// ── CSV parsing ─────────────────────────────────────────────────

function parseCsv(content: string): unknown[][] {
  const result = Papa.parse(content, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  return result.data as unknown[][];
}

// ── XLSX parsing ────────────────────────────────────────────────

function parseXlsx(buffer: Buffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  // Extract first sheet only
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];

  // sheet_to_json with header: 1 returns an array of arrays (row-major)
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  return rows;
}

// ── Cell formatting ─────────────────────────────────────────────

function formatCell(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "string") return cell;
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "boolean") return cell ? "true" : "false";
  if (cell instanceof Date) return cell.toISOString();
  return String(cell);
}
