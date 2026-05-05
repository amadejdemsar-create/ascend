"use client";

import type { FieldDiffResult, TextDiffOp } from "@ascend/diff";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FieldDiffRendererProps {
  diff: FieldDiffResult;
}

function InlineTextDiff({ ops }: { ops: TextDiffOp[] }) {
  return (
    <span>
      {ops.map((op, i) => {
        switch (op.op) {
          case "equal":
            return <span key={i}>{op.text}</span>;
          case "insert":
            return (
              <span
                key={i}
                className="text-green-700 dark:text-green-400 underline decoration-green-700/60"
              >
                {op.text}
              </span>
            );
          case "delete":
            return (
              <span
                key={i}
                className="text-red-700 dark:text-red-400 line-through decoration-red-700/60"
              >
                {op.text}
              </span>
            );
        }
      })}
    </span>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return JSON.stringify(value);
}

export function FieldDiffRenderer({ diff }: FieldDiffRendererProps) {
  if (diff.entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No field changes detected.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground" scope="col">
              Field
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
          {diff.entries.map((entry) => (
            <tr
              key={entry.field}
              className={cn(
                "border-b last:border-b-0",
                entry.change === "modified" && "bg-amber-50/50 dark:bg-amber-950/10",
                entry.change === "added" && "bg-green-50/50 dark:bg-green-950/10",
                entry.change === "removed" && "bg-red-50/50 dark:bg-red-950/10",
              )}
            >
              <td className="px-3 py-2 font-mono text-xs">{entry.field}</td>
              <td className="px-3 py-2 max-w-[200px] truncate">
                {entry.change === "added" ? (
                  <span className="text-muted-foreground">{"—"}</span>
                ) : entry.change === "modified" && entry.textDiff ? (
                  <span className="text-red-700 dark:text-red-400 line-through text-xs">
                    {formatValue(entry.before)}
                  </span>
                ) : (
                  <span className="text-xs">{formatValue(entry.before)}</span>
                )}
              </td>
              <td className="px-3 py-2 max-w-[200px]">
                {entry.change === "removed" ? (
                  <span className="text-muted-foreground">{"—"}</span>
                ) : entry.change === "modified" && entry.textDiff ? (
                  <span className="text-xs">
                    <InlineTextDiff ops={entry.textDiff.ops} />
                  </span>
                ) : (
                  <span className="text-xs">{formatValue(entry.change === "added" ? entry.after : entry.after)}</span>
                )}
              </td>
              <td className="px-3 py-2">
                <Badge
                  variant={
                    entry.change === "added"
                      ? "default"
                      : entry.change === "removed"
                        ? "destructive"
                        : "outline"
                  }
                  className="text-[0.6rem] px-1.5 py-0"
                >
                  {entry.change === "added" ? "Added" : entry.change === "removed" ? "Removed" : "Modified"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
