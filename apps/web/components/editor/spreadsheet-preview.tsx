"use client";

import { useFileStatus } from "@/lib/hooks/use-files";
import { FileSpreadsheet, Loader2 } from "lucide-react";

const MAX_ROWS = 5;
const MAX_COLS = 5;

export function SpreadsheetPreview({ fileId }: { fileId: string }) {
  const { data: status } = useFileStatus(fileId);

  if (!status) {
    return (
      <div className="my-2 flex h-32 items-center justify-center rounded-lg border bg-muted/30">
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (status.extractionStatus === "PENDING" || status.extractionStatus === "EXTRACTING") {
    return (
      <div className="my-2 flex h-32 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30">
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Extracting spreadsheet…</span>
      </div>
    );
  }

  if (status.extractionStatus === "FAILED" || !status.extractedText) {
    return (
      <div className="my-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <FileSpreadsheet className="mr-1.5 inline size-4" aria-hidden="true" />
        Could not preview spreadsheet.
      </div>
    );
  }

  // The extraction handler emits "row N: a, b, c" per line.
  // Parse the first MAX_ROWS lines, strip the "row N: " prefix, split on ", ".
  const lines = status.extractedText.split("\n").slice(0, MAX_ROWS);
  const rows: string[][] = lines.map((line) => {
    const stripped = line.replace(/^row\s+\d+:\s*/i, "");
    return stripped.split(", ").slice(0, MAX_COLS);
  });

  const colCount = Math.min(MAX_COLS, Math.max(...rows.map((r) => r.length), 1));

  return (
    <div className="my-2 overflow-hidden rounded-lg border">
      <div className="flex items-center gap-1.5 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
        <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        <span>{status.filename ?? "Spreadsheet"}</span>
        <span className="ml-auto">
          First {Math.min(MAX_ROWS, rows.length)} rows &times; {colCount} cols
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="border-t first:border-t-0">
                {Array.from({ length: colCount }).map((_, cIdx) => (
                  <td
                    key={cIdx}
                    className="truncate border-r px-3 py-1.5 last:border-r-0 max-w-[12rem]"
                    title={row[cIdx] ?? ""}
                  >
                    {row[cIdx] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
