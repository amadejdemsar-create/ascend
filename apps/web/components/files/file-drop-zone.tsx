"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useUploadFile } from "@/lib/hooks/use-files";
import {
  ALLOWED_MIME_TYPES,
  UPLOAD_MAX_BYTES,
} from "@/lib/validations";

/**
 * Global file drop zone overlay.
 *
 * Mounted once at the app layout level. Listens on `document` for drag events
 * and renders a fullscreen overlay when the user drags files over the window.
 * On drop, each file is uploaded in parallel with `createEntry: true` (auto-
 * creates a ContextEntry of type SOURCE per file).
 *
 * Uses a drag counter ref to handle nested element `dragenter`/`dragleave`
 * transitions correctly (the standard counter pattern: increment on enter,
 * decrement on leave, hide when counter reaches 0).
 */
export function FileDropZone() {
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounterRef = useRef(0);
  const uploadFile = useUploadFile();

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    // Only activate for file drags, not text drags
    if (!e.dataTransfer?.types.includes("Files")) return;
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragActive(true);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    // Required to allow drop (browser default is to deny)
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragActive(false);

      const droppedFiles = e.dataTransfer?.files;
      if (!droppedFiles || droppedFiles.length === 0) return;

      // Validate all files upfront
      const validFiles: globalThis.File[] = [];
      const maxMB = Math.round(UPLOAD_MAX_BYTES / (1024 * 1024));

      for (let i = 0; i < droppedFiles.length; i++) {
        const file = droppedFiles[i];
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
          toast.error(
            `"${file.name}" skipped: type "${file.type || "unknown"}" is not supported`,
          );
          continue;
        }
        if (file.size > UPLOAD_MAX_BYTES) {
          toast.error(
            `"${file.name}" skipped: exceeds the ${maxMB} MiB size limit`,
          );
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) return;

      // Upload all valid files in parallel
      const results = await Promise.allSettled(
        validFiles.map((file) =>
          uploadFile.mutateAsync({ file, createEntry: true }),
        ),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === 0) {
        toast.success(
          validFiles.length === 1
            ? `Uploaded "${validFiles[0].name}"`
            : `Uploaded ${succeeded} file${succeeded !== 1 ? "s" : ""}`,
        );
      } else {
        toast.error(
          `Uploaded ${succeeded} of ${validFiles.length} files. ${failed} failed.`,
        );
        // Log individual errors for debugging
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error(
              `[FileDropZone] Upload failed for "${validFiles[i].name}":`,
              r.reason,
            );
          }
        });
      }
    },
    [uploadFile],
  );

  useEffect(() => {
    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("drop", handleDrop);
    };
  }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

  if (!isDragActive) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="presentation"
    >
      <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-primary/50 bg-card p-12 shadow-lg">
        <Upload className="size-12 text-primary" aria-hidden="true" />
        <div className="text-center">
          <p className="text-lg font-semibold">Drop files to upload</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Files will be added as context entries
          </p>
        </div>
      </div>
    </div>
  );
}
