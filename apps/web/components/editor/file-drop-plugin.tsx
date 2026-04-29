"use client";

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  COMMAND_PRIORITY_HIGH,
  DROP_COMMAND,
  $getSelection,
  $isRangeSelection,
} from "lexical";
import { $createFileNode, $createImageNode } from "@ascend/editor";
import { toast } from "sonner";
import { useUploadFile } from "@/lib/hooks/use-files";
import {
  ALLOWED_MIME_TYPES,
  UPLOAD_MAX_BYTES,
} from "@/lib/validations";

/**
 * FileDropPlugin: Lexical command handler for dropping files onto the editor.
 *
 * Registers a DROP_COMMAND listener at HIGH priority. When files are dropped
 * onto the editor canvas, they are uploaded via `useUploadFile` and inserted
 * as FileNode or ImageNode at the current selection.
 *
 * Because this handler calls `e.preventDefault()` and returns `true`, it
 * consumes the drop event before it bubbles to the document-level
 * FileDropZone. This is intentional: drops inside the editor insert blocks
 * rather than creating standalone context entries.
 */

interface FileDropPluginProps {
  entryId: string;
}

export function FileDropPlugin({ entryId }: FileDropPluginProps) {
  const [editor] = useLexicalComposerContext();
  const uploadFile = useUploadFile();
  // Ref to hold entryId for the command handler closure
  const entryIdRef = useRef(entryId);
  entryIdRef.current = entryId;

  useEffect(() => {
    const removeCommand = editor.registerCommand(
      DROP_COMMAND,
      (event: DragEvent) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        // Check that at least one file is droppable
        const validFiles: globalThis.File[] = [];
        const maxMB = Math.round(UPLOAD_MAX_BYTES / (1024 * 1024));

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
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

        if (validFiles.length === 0) return false;

        // Prevent default and consume the event so FileDropZone does not fire
        event.preventDefault();
        event.stopPropagation();

        // Upload each file and insert the appropriate node
        void (async () => {
          for (const file of validFiles) {
            try {
              const result = await uploadFile.mutateAsync({
                file,
                entryId: entryIdRef.current,
              });
              const newFileId = result.file.id;
              const mime = result.file.mimeType;

              editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                  if (mime.startsWith("image/")) {
                    const imageNode = $createImageNode({
                      src: `/api/files/${newFileId}`,
                      alt: file.name,
                    });
                    selection.insertNodes([imageNode]);
                  } else {
                    const fileNode = $createFileNode({ fileId: newFileId });
                    selection.insertNodes([fileNode]);
                  }
                }
              });
            } catch (err) {
              toast.error(
                `Failed to upload "${file.name}": ${err instanceof Error ? err.message : "Unknown error"}`,
              );
            }
          }
        })();

        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return removeCommand;
  }, [editor, uploadFile]);

  return null;
}
