"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateExternalSource,
  type ExternalSource,
} from "@/lib/hooks/use-external-data";
import type { GithubConfig } from "@/lib/validations";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing source to edit, or undefined for create. (W10 ships only create.) */
  existing?: ExternalSource | null;
}

/**
 * Form dialog for adding an external data source. Wave 10 supports
 * GitHub only; the provider picker is a one-option Select for future
 * expansion.
 */
export function ExternalSourceFormDialog({ open, onOpenChange }: Props) {
  const create = useCreateExternalSource();
  const pending = create.isPending;

  const [name, setName] = useState("GitHub");
  const [pat, setPat] = useState("");
  const [scope, setScope] = useState<"user" | "org">("user");
  const [orgSlug, setOrgSlug] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("GitHub");
    setPat("");
    setScope("user");
    setOrgSlug("");
  }, [open]);

  async function handleSave() {
    if (!name.trim() || !pat.trim()) {
      toast.error("Name and Personal Access Token are required.");
      return;
    }
    if (scope === "org" && !orgSlug.trim()) {
      toast.error("Organization slug is required when scope is Organization.");
      return;
    }
    const config: GithubConfig = {
      scope,
      ...(scope === "org" ? { orgSlug: orgSlug.trim() } : {}),
    };
    try {
      await create.mutateAsync({
        provider: "GITHUB",
        name: name.trim(),
        authType: "PAT",
        credentials: pat.trim(),
        config,
        enabled: true,
      });
      toast.success(`"${name.trim()}" connected.`);
      onOpenChange(false);
    } catch {
      // hook toasts on error
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect GitHub</DialogTitle>
          <DialogDescription>
            Read-only access to your GitHub Issues + Pull Requests.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ext-name">Name</Label>
            <Input
              id="ext-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="GitHub"
              maxLength={100}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ext-pat">Personal Access Token</Label>
            <Input
              id="ext-pat"
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="ghp_..."
              maxLength={2048}
              autoComplete="off"
            />
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Required scopes: <code className="font-mono">repo</code>,{" "}
              <code className="font-mono">read:user</code>,{" "}
              <code className="font-mono">read:org</code>.
              <a
                href="https://github.com/settings/tokens?type=beta"
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                Generate
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ext-scope">Scope</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as "user" | "org")}
            >
              <SelectTrigger id="ext-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">My GitHub (all repos)</SelectItem>
                <SelectItem value="org">Specific organization</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "org" && (
            <div className="space-y-1.5">
              <Label htmlFor="ext-org">Organization slug</Label>
              <Input
                id="ext-org"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                placeholder="my-company"
                maxLength={100}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
