"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { apiHeaders } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FORMATS = [
  { value: "json", label: "JSON (Full Backup)" },
  { value: "csv", label: "CSV (Spreadsheet)" },
  { value: "markdown", label: "Markdown (Readable)" },
  { value: "pdf", label: "PDF (Report)" },
  { value: "docx", label: "DOCX (Document)" },
] as const;

const FILENAMES: Record<string, string> = {
  json: "ascend-export.json",
  csv: "ascend-export.csv",
  markdown: "ascend-export.md",
  pdf: "ascend-report.pdf",
  docx: "ascend-report.docx",
};

export function ExportSection() {
  const [exporting, setExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("json");
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      // Bare fetch (not apiFetch) because the response is a binary blob
      // for download, not JSON. Reuse the shared headers for auth.
      const res = await fetch(`/api/export?format=${selectedFormat}`, {
        headers: apiHeaders,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = FILENAMES[selectedFormat] ?? "ascend-export";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Data</CardTitle>
        <CardDescription>
          Download your goals in various formats for backup or sharing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={exporting}
            onClick={handleExport}
          >
            {exporting ? (
              <>
                <svg
                  className="size-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <Download data-icon="inline-start" className="size-4" />
                Export
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
