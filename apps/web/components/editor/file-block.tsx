"use client";

import { useState, useCallback, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey } from "lexical";
import { $isFileNode } from "@ascend/editor";
import { Download, Replace, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useFileStatus, useUploadFile } from "@/lib/hooks/use-files";
import { apiFetch } from "@/lib/api-client";
import { FileCard } from "@/components/files/file-card";
import { PdfPreview } from "./pdf-preview";
import { AudioPlayer } from "./audio-player";
import { VideoPlayer } from "./video-player";

/**
 * FileBlock: MIME-aware decorator renderer for FileNode.
 *
 * Renders different sub-components based on the file's MIME type:
 * - application/pdf -> PdfPreview (sandboxed iframe)
 * - image/*         -> inline <img> with lightbox-on-click
 * - audio/*         -> AudioPlayer (native <audio> + transcript)
 * - video/*         -> VideoPlayer (native <video> + transcript)
 * - other           -> FileCard (compact metadata card)
 *
 * A floating toolbar (visible on hover/focus) provides Download, Replace,
 * and Delete actions.
 */

interface FileBlockProps {
  nodeKey: string;
  fileId: string;
  entryId: string;
}

export function FileBlock({ nodeKey, fileId, entryId }: FileBlockProps) {
  const [editor] = useLexicalComposerContext();
  const { data: fileStatus, isLoading } = useFileStatus(fileId);
  const uploadFile = useUploadFile();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [imgLightboxOpen, setImgLightboxOpen] = useState(false);

  const mimeType = fileStatus?.mimeType ?? "";
  const filename = fileStatus?.filename ?? "File";

  // ── Actions ──────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    try {
      const result = await apiFetch<{ url: string; expiresAt: string }>(
        `/api/files/${fileId}`,
      );
      window.open(result.url, "_blank");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to get download link",
      );
    }
  }, [fileId]);

  const handleReplace = useCallback(() => {
    replaceInputRef.current?.click();
  }, []);

  const handleReplaceFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsReplacing(true);
      try {
        const result = await uploadFile.mutateAsync({ file, entryId });
        const newFileId = result.file.id;

        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node && $isFileNode(node)) {
            node.setFileId(newFileId);
          }
        });

        toast.success("File replaced");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to replace file",
        );
      } finally {
        setIsReplacing(false);
        // Reset the input so the same file can be re-selected
        if (replaceInputRef.current) {
          replaceInputRef.current.value = "";
        }
      }
    },
    [editor, nodeKey, fileId, entryId, uploadFile],
  );

  const handleDelete = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });
    setShowDeleteDialog(false);
  }, [editor, nodeKey]);

  // ── Loading state ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="my-2 flex h-16 items-center justify-center rounded-lg border bg-muted/30">
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="ml-2 text-sm text-muted-foreground">Loading file...</span>
      </div>
    );
  }

  // ── MIME-aware renderer ──────────────────────────────────────

  let content: React.ReactNode;

  if (mimeType === "application/pdf") {
    content = <PdfPreview fileId={fileId} />;
  } else if (mimeType.startsWith("image/")) {
    content = (
      <FileBlockImage
        fileId={fileId}
        alt={filename}
        lightboxOpen={imgLightboxOpen}
        onLightboxChange={setImgLightboxOpen}
      />
    );
  } else if (mimeType.startsWith("audio/")) {
    content = <AudioPlayer fileId={fileId} />;
  } else if (mimeType.startsWith("video/")) {
    content = <VideoPlayer fileId={fileId} />;
  } else {
    content = (
      <FileCard
        fileId={fileId}
        filename={fileStatus?.filename}
        mimeType={fileStatus?.mimeType}
        sizeBytes={fileStatus?.sizeBytes}
      />
    );
  }

  return (
    <div className="group/file-block relative my-2">
      {/* Floating toolbar: visible on hover or focus-within */}
      <div
        className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 rounded-full border bg-popover px-1 py-0.5 shadow-sm opacity-0 transition-opacity group-hover/file-block:opacity-100 group-focus-within/file-block:opacity-100"
        role="toolbar"
        aria-label="File block actions"
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleDownload}
                  aria-label="Download file"
                />
              }
            >
              <Download className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">Download</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleReplace}
                  disabled={isReplacing}
                  aria-label="Replace file"
                />
              }
            >
              {isReplacing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Replace className="size-3.5" />
              )}
            </TooltipTrigger>
            <TooltipContent side="top">Replace</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowDeleteDialog(true)}
                  aria-label="Delete file block"
                />
              }
            >
              <Trash2 className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">Delete</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Hidden file input for Replace */}
      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        onChange={handleReplaceFile}
        aria-hidden="true"
      />

      {/* MIME-aware content */}
      {content}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove file block?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the file block from the document. The uploaded
              file will remain in storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Internal: image sub-renderer for FileNode ──────────────────

function FileBlockImage({
  fileId,
  alt,
  lightboxOpen,
  onLightboxChange,
}: {
  fileId: string;
  alt: string;
  lightboxOpen: boolean;
  onLightboxChange: (open: boolean) => void;
}) {
  // Use the API route which will 302-redirect to presigned URL for images
  const imgSrc = `/api/files/${fileId}`;

  return (
    <>
      <button
        type="button"
        onClick={() => onLightboxChange(true)}
        className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
        aria-label={`View "${alt}" fullscreen`}
      >
        <img
          src={imgSrc}
          alt={alt}
          className="w-full max-w-full rounded-lg object-contain"
          loading="lazy"
        />
      </button>

      {/* Simple fullscreen overlay */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => onLightboxChange(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div
            className="relative p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-2 right-2 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"
              onClick={() => onLightboxChange(false)}
              aria-label="Close preview"
            >
              <span className="size-5 flex items-center justify-center">&times;</span>
            </button>
            <img
              src={imgSrc}
              alt={alt}
              className="max-w-[90vw] max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
