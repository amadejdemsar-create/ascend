"use client";

import { useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useExternalDataRows,
  useExternalSource,
  useRefreshExternalSchema,
} from "@/lib/hooks/use-external-data";
import type { ExternalDataField, ExternalDataRow } from "@/lib/validations";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  /** The ExternalDataSource.id pulled from ContextEntry.externalDataSourceId */
  externalDataSourceId: string;
}

const DEFAULT_SHAPE = "issues";

/**
 * Wave 10 minimum-viable virtual-database view for EXTERNAL_DATABASE
 * ContextEntries. Renders Issues + PRs (and the Repos shape as a
 * "coming soon" tab) in a table with Refresh schema + Load more cursor
 * pagination. View-config (filters, sort) defers to Wave 10b polish.
 */
export function ExternalDatabaseDetail({ externalDataSourceId }: Props) {
  const { data: source, isLoading: sourceLoading } = useExternalSource(
    externalDataSourceId,
  );
  const refresh = useRefreshExternalSchema();
  const [shape, setShape] = useState<string>(DEFAULT_SHAPE);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const queryInput = useMemo(
    () => ({
      shape,
      cursor,
      perPage: 25,
    }),
    [shape, cursor],
  );

  const { data: page, isFetching } = useExternalDataRows(
    externalDataSourceId,
    source?.enabled ? queryInput : null,
  );

  const config = (source?.config ?? {}) as {
    shapeSchemas?: Record<string, ExternalDataField[]>;
  };
  const schema = config.shapeSchemas?.[shape] ?? FALLBACK_SCHEMA[shape] ?? [];

  async function handleRefresh() {
    try {
      await refresh.mutateAsync(externalDataSourceId);
      toast.success("Schema refreshed.");
    } catch {
      /* hook toasts */
    }
  }

  if (sourceLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        External data source not found.
      </div>
    );
  }

  if (!source.enabled) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        This integration is currently disabled. Re-enable it in
        Settings &rarr; Integrations.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Tabs
          value={shape}
          onValueChange={(v) => {
            setShape(v);
            setCursor(undefined);
          }}
        >
          <TabsList>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="pulls">Pull requests</TabsTrigger>
            <TabsTrigger value="repos" disabled>
              Repos · soon
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={refresh.isPending}
        >
          <RefreshCw
            className={`mr-1.5 size-3.5 ${refresh.isPending ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh schema
        </Button>
      </div>

      {page?.rateLimited && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
          GitHub rate limit reached. Try again in a few minutes.
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              {schema.map((f) => (
                <th
                  key={f.id}
                  className="px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isFetching && !page && (
              <tr>
                <td
                  colSpan={schema.length || 1}
                  className="p-4 text-center text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            )}
            {!isFetching && page?.rows.length === 0 && (
              <tr>
                <td
                  colSpan={schema.length || 1}
                  className="p-4 text-center text-muted-foreground"
                >
                  No rows.
                </td>
              </tr>
            )}
            {page?.rows.map((row) => (
              <ExternalRowTableRow
                key={row.remoteId}
                row={row}
                schema={schema}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {typeof page?.totalCount === "number"
            ? `${page.rows.length} of ${page.totalCount} shown`
            : page?.rows
              ? `${page.rows.length} loaded`
              : ""}
          {source.lastRefreshedAt && (
            <span className="ml-2">
              · schema updated{" "}
              {formatDistanceToNow(new Date(source.lastRefreshedAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </span>
        {page?.nextCursor && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isFetching}
            onClick={() => setCursor(page.nextCursor ?? undefined)}
          >
            Load more
          </Button>
        )}
      </div>
    </div>
  );
}

function ExternalRowTableRow({
  row,
  schema,
}: {
  row: ExternalDataRow;
  schema: ExternalDataField[];
}) {
  return (
    <tr className="border-t hover:bg-muted/30">
      {schema.map((field) => (
        <td
          key={field.id}
          className="px-3 py-2 align-top"
          style={{ maxWidth: 280 }}
        >
          <ExternalRowCell field={field} value={row.data[field.id]} htmlUrl={row.htmlUrl} />
        </td>
      ))}
    </tr>
  );
}

function ExternalRowCell({
  field,
  value,
  htmlUrl,
}: {
  field: ExternalDataField;
  value: unknown;
  htmlUrl?: string;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/50">—</span>;
  }
  switch (field.type) {
    case "URL":
      if (typeof value !== "string") return <span>{String(value)}</span>;
      return (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ExternalLink className="size-3" aria-hidden="true" />
          Open
        </a>
      );
    case "DATE":
      if (typeof value !== "string") return <span>{String(value)}</span>;
      try {
        const d = new Date(value);
        return (
          <span title={d.toISOString()}>
            {formatDistanceToNow(d, { addSuffix: true })}
          </span>
        );
      } catch {
        return <span>{value}</span>;
      }
    case "MULTI_SELECT": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1">
          {arr.slice(0, 4).map((v, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">
              {String(v)}
            </Badge>
          ))}
          {arr.length > 4 && (
            <span className="text-xs text-muted-foreground">+{arr.length - 4}</span>
          )}
        </div>
      );
    }
    case "SELECT": {
      return <Badge variant="outline">{String(value)}</Badge>;
    }
    case "CHECKBOX":
      return <span>{value ? "✓" : "—"}</span>;
    case "NUMBER":
      return <span className="font-mono text-xs">{String(value)}</span>;
    case "TEXT":
      if (field.isPrimary && htmlUrl) {
        return (
          <a
            href={htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium hover:underline"
          >
            {String(value)}
          </a>
        );
      }
      return <span className="line-clamp-2">{String(value)}</span>;
    case "USER":
      return <span className="font-mono text-xs">@{String(value)}</span>;
    case "EMAIL":
      return <span className="font-mono text-xs">{String(value)}</span>;
    default:
      return <span>{String(value)}</span>;
  }
}

/**
 * Fallback schemas (mirror github-adapter's static schemas) used when
 * the source hasn't yet been refresh-schema'd. Display-only; the
 * adapter itself owns the canonical schemas.
 */
const FALLBACK_SCHEMA: Record<string, ExternalDataField[]> = {
  issues: [
    { id: "title", label: "Title", type: "TEXT", isPrimary: true },
    { id: "number", label: "#", type: "NUMBER" },
    { id: "state", label: "State", type: "SELECT" },
    { id: "author", label: "Author", type: "USER" },
    { id: "labels", label: "Labels", type: "MULTI_SELECT" },
    { id: "updatedAt", label: "Updated", type: "DATE" },
    { id: "htmlUrl", label: "URL", type: "URL" },
  ],
  pulls: [
    { id: "title", label: "Title", type: "TEXT", isPrimary: true },
    { id: "number", label: "#", type: "NUMBER" },
    { id: "state", label: "State", type: "SELECT" },
    { id: "author", label: "Author", type: "USER" },
    { id: "baseRef", label: "Base", type: "TEXT" },
    { id: "updatedAt", label: "Updated", type: "DATE" },
    { id: "htmlUrl", label: "URL", type: "URL" },
  ],
};
