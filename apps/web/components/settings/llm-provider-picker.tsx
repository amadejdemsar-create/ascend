"use client";

import { useMemo } from "react";
import { Bot, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useLlmProviders,
  useAiSettings,
  useUpdateAiSettings,
} from "@/lib/hooks/use-llm";
import type { ModelDescriptor, ModelTier } from "@ascend/llm";

const TIER_LABELS: Record<ModelTier, string> = {
  cheap: "Cheap",
  balanced: "Balanced",
  best: "Best",
};

const TIER_ORDER: ModelTier[] = ["cheap", "balanced", "best"];

function formatPrice(costPer1MCents: number): string {
  return `$${(costPer1MCents / 100).toFixed(2)}/1M`;
}

export function LlmProviderPicker() {
  const { data: providersData, isLoading: loadingProviders } =
    useLlmProviders();
  const { data: settings, isLoading: loadingSettings } = useAiSettings();
  const updateSettings = useUpdateAiSettings();

  const selectedProvider = settings?.chatProvider ?? "GEMINI";
  const selectedModel = settings?.chatModel ?? null;

  // Build model options for the selected provider
  const providerInfo = useMemo(() => {
    if (!providersData) return null;
    return providersData.providers.find((p) => p.kind === selectedProvider);
  }, [providersData, selectedProvider]);

  // Group models by tier
  const modelsByTier = useMemo(() => {
    if (!providerInfo) return new Map<ModelTier, ModelDescriptor[]>();
    const map = new Map<ModelTier, ModelDescriptor[]>();
    for (const model of providerInfo.models) {
      const existing = map.get(model.tier) ?? [];
      existing.push(model);
      map.set(model.tier, existing);
    }
    return map;
  }, [providerInfo]);

  // Determine which tier is currently selected
  const currentTier = useMemo(() => {
    if (!selectedModel || !providerInfo) return "balanced";
    const model = providerInfo.models.find((m) => m.id === selectedModel);
    return model?.tier ?? "balanced";
  }, [selectedModel, providerInfo]);

  const handleProviderChange = async (value: string | null) => {
    if (!value) return;
    try {
      // Reset model to null (provider default) when switching providers
      await updateSettings.mutateAsync({
        chatProvider: value,
        chatModel: null,
      });
      toast.success(`Switched to ${value.charAt(0) + value.slice(1).toLowerCase()}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update provider",
      );
    }
  };

  const handleTierChange = async (tier: string | null) => {
    if (!tier || !providerInfo) return;
    // Find the first model for this tier (prefer stable over preview)
    const models = modelsByTier.get(tier as ModelTier) ?? [];
    const stableModel = models.find((m) => m.status === "stable") ?? models[0];
    if (!stableModel) return;

    try {
      await updateSettings.mutateAsync({ chatModel: stableModel.id });
      toast.success(`Switched to ${stableModel.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update model",
      );
    }
  };

  if (loadingProviders || loadingSettings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4 text-muted-foreground" />
            AI Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  const providers = providersData?.providers ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4 text-muted-foreground" />
          AI Provider
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider select */}
        <div className="space-y-1.5">
          <label
            htmlFor="provider-select"
            className="text-xs font-medium text-muted-foreground"
          >
            Provider
          </label>
          <Select
            value={selectedProvider}
            onValueChange={handleProviderChange}
            disabled={updateSettings.isPending}
          >
            <SelectTrigger id="provider-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.kind} value={p.kind}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${
                        p.available ? "bg-green-500" : "bg-amber-500"
                      }`}
                    />
                    <span>
                      {p.kind.charAt(0) + p.kind.slice(1).toLowerCase()}
                    </span>
                    {!p.available && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={<Info className="size-3 text-amber-500" />}
                          />
                          <TooltipContent>
                            <p className="text-xs">
                              Add API key to Dokploy env to enable
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model tier select */}
        <div className="space-y-1.5">
          <label
            htmlFor="tier-select"
            className="text-xs font-medium text-muted-foreground"
          >
            Model tier
          </label>
          <Select
            value={currentTier}
            onValueChange={handleTierChange}
            disabled={updateSettings.isPending}
          >
            <SelectTrigger id="tier-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIER_ORDER.map((tier) => {
                const models = modelsByTier.get(tier) ?? [];
                if (models.length === 0) return null;
                const primary =
                  models.find((m) => m.status === "stable") ?? models[0];
                return (
                  <SelectItem key={tier} value={tier}>
                    <div className="flex items-center gap-2">
                      <span>{TIER_LABELS[tier]}</span>
                      <span className="text-muted-foreground text-xs">
                        {primary.id}
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        {formatPrice(primary.costPer1MInputCents)} in /{" "}
                        {formatPrice(primary.costPer1MOutputCents)} out
                      </span>
                      {primary.status === "preview" && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-3.5 text-amber-600 border-amber-300"
                        >
                          Preview
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Current model info */}
        {providerInfo && selectedModel && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>Active model:</span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
              {selectedModel}
            </code>
          </div>
        )}
        {providerInfo && !selectedModel && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>Using provider default (balanced tier)</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
