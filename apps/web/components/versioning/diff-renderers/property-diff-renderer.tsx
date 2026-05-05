"use client";

import type { PropertyDiffResult, TextDiffOp } from "@ascend/diff";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CheckIcon, XIcon, StarIcon } from "lucide-react";

interface PropertyDiffRendererProps {
  diff: PropertyDiffResult;
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

function formatPropertyValue(value: unknown, fieldType: string): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground">{"—"}</span>;

  switch (fieldType) {
    case "TEXT":
    case "URL":
    case "EMAIL":
    case "PHONE":
      return <span className="break-all">{String(value)}</span>;

    case "NUMBER":
      return <span className="font-mono">{typeof value === "number" ? value.toLocaleString() : String(value)}</span>;

    case "DATE": {
      if (typeof value === "string") {
        try {
          const d = new Date(value);
          return <span>{format(d, "d. M. yyyy")}</span>;
        } catch {
          return <span>{value}</span>;
        }
      }
      return <span>{String(value)}</span>;
    }

    case "SELECT":
      return (
        <Badge variant="secondary" className="text-[0.6rem] px-1.5 py-0">
          {String(value)}
        </Badge>
      );

    case "MULTI_SELECT": {
      const items = Array.isArray(value) ? value : [value];
      return (
        <span className="flex flex-wrap gap-0.5">
          {items.map((item, i) => (
            <Badge key={i} variant="secondary" className="text-[0.6rem] px-1.5 py-0">
              {String(item)}
            </Badge>
          ))}
        </span>
      );
    }

    case "RELATION": {
      const ids = Array.isArray(value) ? value : [value];
      return (
        <span className="text-xs text-muted-foreground font-mono">
          {ids.map(String).join(", ")}
        </span>
      );
    }

    case "CHECKBOX":
      return value ? (
        <CheckIcon className="size-4 text-green-700" aria-label="Checked" />
      ) : (
        <XIcon className="size-4 text-red-700" aria-label="Unchecked" />
      );

    case "RATING": {
      const count = typeof value === "number" ? value : 0;
      return (
        <span className="flex items-center gap-0.5" aria-label={`${count} stars`}>
          {Array.from({ length: count }, (_, i) => (
            <StarIcon key={i} className="size-3 fill-amber-500 text-amber-500" />
          ))}
        </span>
      );
    }

    case "FILE":
      return <span className="text-xs font-mono">{String(value)}</span>;

    case "FORMULA":
    case "USER":
    default:
      return (
        <span className="text-xs" title={`Type: ${fieldType}`}>
          {typeof value === "object" ? JSON.stringify(value) : String(value)}
        </span>
      );
  }
}

export function PropertyDiffRenderer({ diff }: PropertyDiffRendererProps) {
  if (diff.entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No property changes detected.
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
              key={entry.fieldId}
              className={cn(
                "border-b last:border-b-0",
                entry.change === "modified" && "bg-amber-50/50 dark:bg-amber-950/10",
                entry.change === "added" && "bg-green-50/50 dark:bg-green-950/10",
                entry.change === "removed" && "bg-red-50/50 dark:bg-red-950/10",
              )}
            >
              <td className="px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">{entry.fieldName}</span>
                  <span className="text-[0.6rem] text-muted-foreground font-mono">
                    {entry.fieldType}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 max-w-[180px]">
                {entry.change === "added" ? (
                  <span className="text-muted-foreground">{"—"}</span>
                ) : entry.change === "modified" && entry.textDiff ? (
                  <span className="text-xs">
                    <InlineTextDiff ops={entry.textDiff.ops} />
                  </span>
                ) : (
                  formatPropertyValue(entry.before, entry.fieldType)
                )}
              </td>
              <td className="px-3 py-2 max-w-[180px]">
                {entry.change === "removed" ? (
                  <span className="text-muted-foreground">{"—"}</span>
                ) : entry.change === "modified" && !entry.textDiff ? (
                  formatPropertyValue(entry.after, entry.fieldType)
                ) : entry.change === "added" ? (
                  formatPropertyValue(entry.after, entry.fieldType)
                ) : null}
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
