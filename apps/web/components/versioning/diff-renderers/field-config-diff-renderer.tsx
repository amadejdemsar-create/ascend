"use client";

import type { FieldConfigDiffResult } from "@ascend/diff";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldConfigDiffRendererProps {
  diff: FieldConfigDiffResult;
}

function formatConfigValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

export function FieldConfigDiffRenderer({ diff }: FieldConfigDiffRendererProps) {
  const hasNameChange = !!diff.nameChange;
  const hasTypeChange = !!diff.typeChange;
  const hasConfigChanges = diff.configChanges.length > 0;

  if (!hasNameChange && !hasTypeChange && !hasConfigChanges) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No field configuration changes detected.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Name change */}
      {hasNameChange && diff.nameChange && (
        <div className="flex items-center gap-2 rounded-md border border-amber-700/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Renamed:</span>
          <span className="font-mono text-red-700 dark:text-red-400 line-through">
            {diff.nameChange.before}
          </span>
          <ArrowRightIcon className="size-3 text-muted-foreground" aria-hidden="true" />
          <span className="font-mono text-green-700 dark:text-green-400">
            {diff.nameChange.after}
          </span>
        </div>
      )}

      {/* Type change */}
      {hasTypeChange && diff.typeChange && (
        <div className="flex items-center gap-2 rounded-md border border-blue-700/40 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Type changed:</span>
          <Badge variant="secondary" className="text-[0.6rem] px-1.5 py-0 font-mono">
            {diff.typeChange.before}
          </Badge>
          <ArrowRightIcon className="size-3 text-muted-foreground" aria-hidden="true" />
          <Badge variant="secondary" className="text-[0.6rem] px-1.5 py-0 font-mono">
            {diff.typeChange.after}
          </Badge>
        </div>
      )}

      {/* Config property changes */}
      {hasConfigChanges && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground" scope="col">
                  Config key
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground" scope="col">
                  Before
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground" scope="col">
                  After
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20" scope="col">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {diff.configChanges.map((change) => (
                <tr
                  key={change.key}
                  className={cn(
                    "border-b last:border-b-0",
                    change.change === "modified" && "bg-amber-50/50 dark:bg-amber-950/10",
                    change.change === "added" && "bg-green-50/50 dark:bg-green-950/10",
                    change.change === "removed" && "bg-red-50/50 dark:bg-red-950/10",
                  )}
                >
                  <td className="px-3 py-2 font-mono text-xs">{change.key}</td>
                  <td className="px-3 py-2 max-w-[200px]">
                    {change.change === "added" ? (
                      <span className="text-muted-foreground">{"—"}</span>
                    ) : (
                      <pre className="text-xs whitespace-pre-wrap break-all">
                        {formatConfigValue(change.before)}
                      </pre>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[200px]">
                    {change.change === "removed" ? (
                      <span className="text-muted-foreground">{"—"}</span>
                    ) : (
                      <pre className="text-xs whitespace-pre-wrap break-all">
                        {formatConfigValue(change.after)}
                      </pre>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        change.change === "added"
                          ? "default"
                          : change.change === "removed"
                            ? "destructive"
                            : "outline"
                      }
                      className="text-[0.6rem] px-1.5 py-0"
                    >
                      {change.change === "added"
                        ? "Added"
                        : change.change === "removed"
                          ? "Removed"
                          : "Modified"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
