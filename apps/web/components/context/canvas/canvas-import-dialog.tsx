"use client";

import { useRef, useState } from "react";
import { Upload, FileWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useImportFile } from "@/lib/hooks/use-canvas";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  layoutId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportMode = "replace" | "merge";

const IMPORT_MAX_BYTES = 4 * 1024 * 1024; // 4 MiB pre-parse cap (matches server)

interface ParsedFile {
  elements: unknown[];
  appState: Record<string, unknown>;
  files?: Record<string, unknown>;
  rawName: string;
}

export function CanvasImportDialog({ layoutId, open, onOpenChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mode, setMode] = useState<ImportMode>("replace");
  const [parseError, setParseError] = useState<string | null>(null);
  const importFile = useImportFile();

  function reset() {
    setParsed(null);
    setMode("replace");
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setParsed(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith(".tldr")) {
      setParseError(
        "Tldraw (.tldr) import is not supported. Please export your tldraw drawing to .excalidraw first.",
      );
      return;
    }

    if (!file.name.toLowerCase().endsWith(".excalidraw")) {
      setParseError(
        "Only .excalidraw files are supported. Other formats are not yet recognized.",
      );
      return;
    }

    if (file.size > IMPORT_MAX_BYTES) {
      setParseError(
        `File exceeds 4 MiB cap (${(file.size / 1024 / 1024).toFixed(1)} MiB). Reduce element count or strip embedded images.`,
      );
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (
        typeof json !== "object" ||
        json === null ||
        !Array.isArray((json as { elements?: unknown }).elements)
      ) {
        throw new Error(
          "Not a valid Excalidraw file: missing or invalid elements array.",
        );
      }
      const env = json as Record<string, unknown>;
      if (
        env.type !== undefined &&
        env.type !== "excalidraw" &&
        env.type !== "excalidrawClipboard"
      ) {
        throw new Error(
          `Unexpected envelope type "${String(env.type)}". Expected "excalidraw".`,
        );
      }
      setParsed({
        elements: env.elements as unknown[],
        appState:
          typeof env.appState === "object" && env.appState !== null
            ? (env.appState as Record<string, unknown>)
            : {},
        files:
          typeof env.files === "object" && env.files !== null
            ? (env.files as Record<string, unknown>)
            : undefined,
        rawName: file.name,
      });
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Failed to parse file.",
      );
    }
  }

  async function handleImport() {
    if (!parsed) return;
    try {
      await importFile.mutateAsync({
        layoutId,
        format: "excalidraw",
        mode,
        scene: {
          elements: parsed.elements as never,
          appState: parsed.appState as never,
          files: parsed.files as never,
        },
      });
      toast.success(`Imported ${parsed.elements.length} elements.`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import canvas</DialogTitle>
          <DialogDescription>
            Load an .excalidraw file into this layout. Tldraw (.tldr) files
            are not supported; export to .excalidraw first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".excalidraw,application/json"
            onChange={handleFileChange}
            className="block w-full cursor-pointer rounded-md border border-input bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
          />
          {parseError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <div>{parseError}</div>
                {parseError.includes("Tldraw") && (
                  <a
                    href="https://tldraw.com"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs underline underline-offset-2 hover:opacity-80"
                  >
                    Open tldraw &rarr; Menu &rarr; Export as &rarr; .excalidraw
                  </a>
                )}
              </div>
            </div>
          )}
          {parsed && (
            <>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{parsed.rawName}</div>
                <div className="text-xs text-muted-foreground">
                  {parsed.elements.length} element
                  {parsed.elements.length === 1 ? "" : "s"} detected
                  {parsed.files
                    ? ` · ${Object.keys(parsed.files).length} embedded file(s)`
                    : ""}
                </div>
              </div>
              <fieldset className="space-y-2">
                <Label className="text-sm font-medium">Mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("replace")}
                    className={cn(
                      "rounded-md border bg-card px-3 py-2 text-left text-sm hover:border-primary/40",
                      mode === "replace" &&
                        "border-primary/60 bg-primary/5 ring-2 ring-primary/30",
                    )}
                  >
                    <div className="font-medium">Replace</div>
                    <div className="text-xs text-muted-foreground">
                      Discard current scene
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("merge")}
                    className={cn(
                      "rounded-md border bg-card px-3 py-2 text-left text-sm hover:border-primary/40",
                      mode === "merge" &&
                        "border-primary/60 bg-primary/5 ring-2 ring-primary/30",
                    )}
                  >
                    <div className="font-medium">Merge</div>
                    <div className="text-xs text-muted-foreground">
                      Add to current scene
                    </div>
                  </button>
                </div>
              </fieldset>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importFile.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parsed || importFile.isPending}
          >
            {importFile.isPending ? (
              "Importing..."
            ) : (
              <>
                <Upload className="mr-2 size-4" aria-hidden="true" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
