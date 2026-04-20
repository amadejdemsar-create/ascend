"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, CheckCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface ImportResult {
  categoriesCreated: number;
  goalsCreated: number;
  errors?: string[];
}

export function ImportSection() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setError(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const data = await apiFetch<ImportResult>("/api/import", {
        method: "POST",
        body: JSON.stringify(json),
      });
      setResult(data);

      // Invalidate caches so new data appears immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      ]);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON file. Please select a valid JSON file.");
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setImporting(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Data</CardTitle>
        <CardDescription>
          Import goals from a JSON file. Supports Ascend exports and legacy
          todos.json format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="outline"
          disabled={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          {importing ? (
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
              Importing...
            </>
          ) : (
            <>
              <Upload data-icon="inline-start" className="size-4" />
              Choose File
            </>
          )}
        </Button>

        {result && (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              Imported {result.categoriesCreated} categories and{" "}
              {result.goalsCreated} goals.
            </span>
          </div>
        )}

        {result?.errors && result.errors.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{result.errors.length} items had errors</span>
              <ChevronDown className="ml-auto size-4 transition-transform [[data-open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 space-y-1 pl-6 text-sm text-amber-700 dark:text-amber-400">
                {result.errors.map((err, i) => (
                  <li key={i} className="list-disc">
                    {err}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
