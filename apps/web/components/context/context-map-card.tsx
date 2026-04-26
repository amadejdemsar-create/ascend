"use client";

import { useState } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Compass,
  Target,
  Lightbulb,
  AlertTriangle,
  CircleDot,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useContextMap,
  useRefreshContextMap,
} from "@/lib/hooks/use-context-map";
import type { ContextMapContent, ContextMapItem } from "@/lib/validations";

// ── Section config ──────────────────────────────────────────────

const SECTION_CONFIG = [
  { key: "themes" as const, label: "Themes", icon: Compass, color: "text-blue-500" },
  { key: "principles" as const, label: "Principles", icon: Lightbulb, color: "text-amber-500" },
  { key: "projects" as const, label: "Projects", icon: Target, color: "text-green-500" },
  { key: "tensions" as const, label: "Tensions", icon: AlertTriangle, color: "text-red-500" },
  { key: "orphans" as const, label: "Orphans", icon: CircleDot, color: "text-muted-foreground" },
];

const MAX_VISIBLE_ITEMS = 5;

// ── Component ───────────────────────────────────────────────────

export function ContextMapCard() {
  const { data: map, isLoading, error } = useContextMap();
  const refreshMutation = useRefreshContextMap();

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      toast.success("Context Map refreshed");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to refresh map";
      toast.error(message);
    }
  };

  // ── Loading state ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // ── Error state ─────────────────────────────────────────────────
  if (error) {
    return (
      <Card className="mb-4">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-destructive">
              Failed to load Context Map
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────
  if (!map) {
    return (
      <Card className="mb-4">
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <Sparkles className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No Context Map yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Generate a synthesized view of your knowledge graph.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 mr-1.5" />
                  Generate your first map
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Map content ─────────────────────────────────────────────────
  const content = map.content as ContextMapContent;
  const generatedAt = new Date(map.generatedAt);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Context Map
          </CardTitle>
          <div className="flex items-center gap-2">
            <CooldownRefreshButton
              generatedAt={generatedAt}
              isPending={refreshMutation.isPending}
              onRefresh={handleRefresh}
              provider={map.provider}
              model={map.model}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {content.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {content.summary}
          </p>
        )}
        {SECTION_CONFIG.map(({ key, label, icon, color }) => {
          const items = content[key] ?? [];
          if (items.length === 0) return null;
          return (
            <MapSection
              key={key}
              label={label}
              icon={icon}
              iconColor={color}
              items={items}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Map section (collapsible) ───────────────────────────────────

function MapSection({
  label,
  icon: Icon,
  iconColor,
  items,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  items: ContextMapItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const visibleItems = showAll ? items : items.slice(0, MAX_VISIBLE_ITEMS);
  const hasMore = items.length > MAX_VISIBLE_ITEMS;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-1 text-xs hover:bg-muted/50 rounded px-1 transition-colors">
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground shrink-0" />
        )}
        <Icon className={`size-3.5 ${iconColor} shrink-0`} />
        <span className="font-medium">{label}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
          {items.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-7 space-y-1 py-1">
          {visibleItems.map((item, i) => (
            <MapItem key={i} item={item} />
          ))}
          {hasMore && !showAll && (
            <button
              type="button"
              className="text-[11px] text-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(true);
              }}
            >
              Show all {items.length}
            </button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Single map item ─────────────────────────────────────────────

function MapItem({ item }: { item: ContextMapItem }) {
  const handleClick = () => {
    if (item.entryIds.length > 0) {
      window.dispatchEvent(
        new CustomEvent("ascend:context-filter", {
          detail: { entryIds: item.entryIds },
        }),
      );
    }
  };

  return (
    <button
      type="button"
      className="w-full text-left hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors group"
      onClick={handleClick}
      title={item.description}
    >
      <span className="text-xs group-hover:text-primary transition-colors">
        {item.title}
      </span>
      {item.description && (
        <span className="text-[10px] text-muted-foreground ml-1.5 hidden group-hover:inline">
          {item.description.length > 60
            ? item.description.slice(0, 60) + "..."
            : item.description}
        </span>
      )}
    </button>
  );
}

// ── Refresh button with cooldown ────────────────────────────────

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

function CooldownRefreshButton({
  generatedAt,
  isPending,
  onRefresh,
  provider,
  model,
}: {
  generatedAt: Date;
  isPending: boolean;
  onRefresh: () => void;
  provider: string;
  model: string;
}) {
  const [now, setNow] = useState(Date.now());

  // Update every 30s to refresh the countdown
  useState(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  });

  const elapsed = now - generatedAt.getTime();
  const cooldownRemaining = COOLDOWN_MS - elapsed;
  const isOnCooldown = cooldownRemaining > 0;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatCooldown = (ms: number) => {
    const minutes = Math.ceil(ms / 60_000);
    return `${minutes} min`;
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground">
        {formatTime(generatedAt)} · {provider.toLowerCase()} · {model.split("/").pop()}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        onClick={onRefresh}
        disabled={isPending || isOnCooldown}
        title={
          isOnCooldown
            ? `Available in ${formatCooldown(cooldownRemaining)}`
            : "Refresh Context Map"
        }
        aria-label="Refresh Context Map"
      >
        <RefreshCw
          className={`size-3.5 ${isPending ? "animate-spin" : ""}`}
        />
      </Button>
    </div>
  );
}

// ── Clear filter pill ───────────────────────────────────────────

export function ContextMapFilterPill({
  onClear,
}: {
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
      <Sparkles className="size-3" />
      <span>Map filter active</span>
      <button
        type="button"
        onClick={onClear}
        className="hover:bg-primary/20 rounded-full p-0.5"
        aria-label="Clear map filter"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
