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
  useCreateMcpServer,
  useUpdateMcpServer,
  type McpConnection,
} from "@/lib/hooks/use-mcp-servers";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing connection to edit, or undefined for create. */
  existing?: McpConnection | null;
}

type Transport = "HTTP_STREAMABLE" | "SSE";
type AuthType = "NONE" | "API_KEY" | "BEARER";

/**
 * Form dialog for creating + editing MCP server connections.
 *
 * Edit path: credentials field is initially empty; leaving it empty
 * preserves the existing stored ciphertext server-side. Entering a new
 * value re-encrypts. Flipping authType to NONE clears credentials.
 */
export function McpServerFormDialog({ open, onOpenChange, existing }: Props) {
  const isEdit = !!existing;
  const create = useCreateMcpServer();
  const update = useUpdateMcpServer();
  const pending = create.isPending || update.isPending;

  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [transport, setTransport] = useState<Transport>("HTTP_STREAMABLE");
  const [authType, setAuthType] = useState<AuthType>("NONE");
  const [credentials, setCredentials] = useState("");

  // Seed fields when opening for edit; reset on close.
  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setEndpoint(existing.endpoint);
      setTransport(existing.transport);
      setAuthType(existing.authType);
      setCredentials(""); // never seed; empty = keep existing
    } else {
      setName("");
      setEndpoint("");
      setTransport("HTTP_STREAMABLE");
      setAuthType("NONE");
      setCredentials("");
    }
  }, [open, existing]);

  async function handleSave() {
    if (!name.trim() || !endpoint.trim()) {
      toast.error("Name and endpoint are required.");
      return;
    }
    if (authType !== "NONE" && !isEdit && !credentials) {
      toast.error("Credentials are required when an auth type is selected.");
      return;
    }
    try {
      if (isEdit && existing) {
        await update.mutateAsync({
          id: existing.id,
          input: {
            name: name.trim(),
            endpoint: endpoint.trim(),
            transport,
            authType,
            ...(credentials ? { credentials } : {}),
          },
        });
        toast.success("Server updated.");
      } else {
        await create.mutateAsync({
          name: name.trim(),
          endpoint: endpoint.trim(),
          transport,
          authType,
          ...(authType !== "NONE" && credentials ? { credentials } : {}),
          enabled: true,
        });
        toast.success(`Server "${name.trim()}" added.`);
      }
      onOpenChange(false);
    } catch {
      // Error already surfaced by the hook's onError toast.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit MCP server" : "Add MCP server"}
          </DialogTitle>
          <DialogDescription>
            Connect an external MCP server. Its tools will appear
            alongside Ascend&apos;s when an AI client lists tools.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mcp-name">Name</Label>
            <Input
              id="mcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Linear, GitHub, etc."
              maxLength={50}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-endpoint">Endpoint URL</Label>
            <Input
              id="mcp-endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://mcp.example.com/server"
              maxLength={2000}
              type="url"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-transport">Transport</Label>
            <Select
              value={transport}
              onValueChange={(v) => setTransport(v as Transport)}
            >
              <SelectTrigger id="mcp-transport">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HTTP_STREAMABLE">
                  Streamable HTTP
                </SelectItem>
                <SelectItem value="SSE">Server-Sent Events</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-auth">Authentication</Label>
            <Select
              value={authType}
              onValueChange={(v) => setAuthType(v as AuthType)}
            >
              <SelectTrigger id="mcp-auth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">None</SelectItem>
                <SelectItem value="API_KEY">API key</SelectItem>
                <SelectItem value="BEARER">Bearer token</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {authType !== "NONE" && (
            <div className="space-y-1.5">
              <Label htmlFor="mcp-credentials">
                {authType === "BEARER" ? "Bearer token" : "API key"}
                {isEdit && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (leave empty to keep existing)
                  </span>
                )}
              </Label>
              <Input
                id="mcp-credentials"
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder={
                  isEdit
                    ? existing?.hasCredentials
                      ? "•••••••••• (encrypted)"
                      : "Enter credentials"
                    : "Enter credentials"
                }
                type="password"
                maxLength={2048}
                autoComplete="off"
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
            {pending ? "Saving..." : isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
