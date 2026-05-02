"use client";

import { useCallback, useState } from "react";
import {
  FileIcon,
  FileTextIcon,
  ImageIcon,
  MusicIcon,
  PlusIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUploadFile } from "@/lib/hooks/use-files";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface FileInfo {
  id: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
}

interface FileEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "FILE" }> };
  value: string[] | null; // file IDs
  onChange: (next: string[] | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Resolved file metadata for display. Parent provides this. */
  resolvedFiles?: FileInfo[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getMimeIcon(mimeType?: string) {
  if (!mimeType) return FileIcon;
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("audio/")) return MusicIcon;
  if (mimeType.startsWith("video/")) return VideoIcon;
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/")
  ) {
    return FileTextIcon;
  }
  return FileIcon;
}

// ── Component ─────────────────────────────────────────────────────────────

export function FileEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
  resolvedFiles = [],
}: FileEditorProps) {
  const [open, setOpen] = useState(autoFocus ?? false);
  const uploadFile = useUploadFile();

  const maxFiles = field.config.maxFiles ?? 5;
  const fileIds = value ?? [];
  const resolvedMap = new Map(resolvedFiles.map((f) => [f.id, f]));
  const currentFiles = fileIds
    .map((id) => resolvedMap.get(id))
    .filter(Boolean) as FileInfo[];

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remaining = maxFiles - fileIds.length;
      if (remaining <= 0) {
        toast.error(`Maximum of ${maxFiles} files allowed`);
        return;
      }

      const toUpload = Array.from(files).slice(0, remaining);

      for (const file of toUpload) {
        try {
          const result = await uploadFile.mutateAsync({
            file,
            createEntry: false,
          });
          // Append the new file ID
          const updated = [...(value ?? []), result.file.id];
          onChange(updated);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Upload failed",
          );
        }
      }

      // Reset input
      e.target.value = "";
    },
    [fileIds.length, maxFiles, onChange, uploadFile, value],
  );

  function removeFile(fileId: string) {
    const next = fileIds.filter((id) => id !== fileId);
    onChange(next.length > 0 ? next : null);
  }

  // ── File chip ─────────────────────────────────────────────────────────

  function FileChip({
    file,
    showRemove,
  }: {
    file: FileInfo;
    showRemove: boolean;
  }) {
    const Icon = getMimeIcon(file.mimeType);
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium max-w-[120px]">
        <Icon className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="truncate">{file.filename}</span>
        {showRemove && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeFile(file.id);
            }}
            className="rounded-full p-0.5 hover:bg-foreground/10 transition-colors shrink-0"
            aria-label={`Remove ${file.filename}`}
          >
            <XIcon className="size-2.5" aria-hidden="true" />
          </button>
        )}
      </span>
    );
  }

  // ── Upload button ─────────────────────────────────────────────────────

  function UploadButton({ compact }: { compact?: boolean }) {
    const canUpload = fileIds.length < maxFiles;
    return (
      <label
        className={cn(
          "inline-flex items-center gap-1 rounded-md text-xs cursor-pointer transition-colors",
          compact
            ? "px-1.5 py-1 text-muted-foreground hover:text-foreground hover:bg-accent"
            : "px-2 py-1.5 border border-dashed text-muted-foreground hover:bg-muted",
          (!canUpload || disabled || uploadFile.isPending) && "pointer-events-none opacity-50",
        )}
      >
        <PlusIcon className="size-3" aria-hidden="true" />
        <span>{uploadFile.isPending ? "Uploading..." : "Upload"}</span>
        <input
          type="file"
          className="sr-only"
          onChange={handleUpload}
          disabled={!canUpload || disabled || uploadFile.isPending}
          aria-label={`Upload file for ${field.name}`}
          multiple
        />
      </label>
    );
  }

  // ── Expanded mode ─────────────────────────────────────────────────────

  if (mode === "expanded") {
    return (
      <div className="space-y-2">
        {currentFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {currentFiles.map((file) => (
              <FileChip key={file.id} file={file} showRemove={true} />
            ))}
          </div>
        )}
        {currentFiles.length === 0 && (
          <span className="text-sm text-muted-foreground">No files attached</span>
        )}
        <UploadButton />
      </div>
    );
  }

  // ── Cell mode ─────────────────────────────────────────────────────────

  const cellVisible = currentFiles.slice(0, 2);
  const cellOverflow = currentFiles.length - 2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "w-full text-left rounded px-1.5 py-1 transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-label={`Edit ${field.name}`}
      >
        {currentFiles.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap">
            {cellVisible.map((file) => (
              <FileChip key={file.id} file={file} showRemove={false} />
            ))}
            {cellOverflow > 0 && (
              <span className="text-xs text-muted-foreground">+{cellOverflow}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">&mdash;</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex flex-col gap-2">
          {currentFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              {(() => {
                const Icon = getMimeIcon(file.mimeType);
                return <Icon className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />;
              })()}
              <span className="truncate flex-1 text-xs">{file.filename}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="rounded p-0.5 hover:bg-destructive/10 transition-colors"
                  aria-label={`Remove ${file.filename}`}
                >
                  <XIcon className="size-3 text-muted-foreground" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          <UploadButton compact />
        </div>
      </PopoverContent>
    </Popover>
  );
}
