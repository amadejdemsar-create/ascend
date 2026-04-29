"use client";

/**
 * DecoratorPlugin: handles rendering of custom decorator nodes in the web layer.
 *
 * For Wave 3, WikiLinkNode and MentionNode use their createDOM() method
 * for rendering (styled via editor.css). Their text content is set by
 * Lexical's built-in text rendering.
 *
 * AIBlockNode, FileNode, and ImageNode rendering is handled via portals:
 * since they need interactive React UI, we register MutationListeners for
 * each node type. When a node is created, we look up its DOM container
 * (from createDOM) and render a React component into it via createPortal.
 *
 * In Wave 8, this will be replaced by proper React-based DecoratorNode
 * subclasses in the web layer, but for Wave 3/4 the portal approach
 * works for the single-user case.
 */

import { useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, $nodesOfType } from "lexical";
import {
  $isAIBlockNode,
  AIBlockNode,
  $isFileNode,
  FileNode,
  $isImageNode,
  ImageNode,
} from "@ascend/editor";
import { createPortal } from "react-dom";
import { AIBlockUI } from "./ai-block-ui";
import { FileBlock } from "./file-block";
import { ImageBlock } from "./image-block";

// ── Type definitions for tracked blocks ──────────────────────

interface AIBlockInfo {
  nodeKey: string;
  domElement: HTMLElement;
  prompt: string;
  aiState: "idle" | "running" | "done";
  result: string | null;
}

interface FileBlockInfo {
  nodeKey: string;
  domElement: HTMLElement;
  fileId: string;
}

interface ImageBlockInfo {
  nodeKey: string;
  domElement: HTMLElement;
  src: string;
  alt: string | null;
  caption: string | null;
}

// ── Shared mutation merge helper ─────────────────────────────

/**
 * Merge new block info into an existing array, handling created/updated
 * and destroyed mutations. Returns a new array.
 */
function mergeBlocks<T extends { nodeKey: string }>(
  prev: T[],
  newBlocks: T[],
  destroyedKeys: Set<string>,
): T[] {
  const kept = prev.filter((b) => !destroyedKeys.has(b.nodeKey));
  for (const newBlock of newBlocks) {
    const existingIdx = kept.findIndex((b) => b.nodeKey === newBlock.nodeKey);
    if (existingIdx >= 0) {
      kept[existingIdx] = newBlock;
    } else {
      kept.push(newBlock);
    }
  }
  return kept;
}

// ── Props ────────────────────────────────────────────────────

interface DecoratorPluginProps {
  entryId: string;
}

export function DecoratorPlugin({ entryId }: DecoratorPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [aiBlocks, setAIBlocks] = useState<AIBlockInfo[]>([]);
  const [fileBlocks, setFileBlocks] = useState<FileBlockInfo[]>([]);
  const [imageBlocks, setImageBlocks] = useState<ImageBlockInfo[]>([]);

  // ── AIBlockNode mutation listener ──────────────────────────

  useEffect(() => {
    const removeListener = editor.registerMutationListener(
      AIBlockNode,
      (mutations) => {
        editor.getEditorState().read(() => {
          const currentBlocks: AIBlockInfo[] = [];
          const destroyedKeys = new Set<string>();

          for (const [key, mutation] of mutations) {
            if (mutation === "destroyed") {
              destroyedKeys.add(key);
              continue;
            }

            const node = $getNodeByKey(key);
            if (!node || !$isAIBlockNode(node)) continue;

            const aiNode = node as AIBlockNode;
            const dom = editor.getElementByKey(key);
            if (!dom) continue;

            currentBlocks.push({
              nodeKey: key,
              domElement: dom,
              prompt: aiNode.getPrompt(),
              aiState: aiNode.getAIState(),
              result: aiNode.getResult(),
            });
          }

          setAIBlocks((prev) => mergeBlocks(prev, currentBlocks, destroyedKeys));
        });
      },
    );

    return removeListener;
  }, [editor]);

  // ── FileNode mutation listener ─────────────────────────────

  useEffect(() => {
    const removeListener = editor.registerMutationListener(
      FileNode,
      (mutations) => {
        editor.getEditorState().read(() => {
          const currentBlocks: FileBlockInfo[] = [];
          const destroyedKeys = new Set<string>();

          for (const [key, mutation] of mutations) {
            if (mutation === "destroyed") {
              destroyedKeys.add(key);
              continue;
            }

            const node = $getNodeByKey(key);
            if (!node || !$isFileNode(node)) continue;

            const dom = editor.getElementByKey(key);
            if (!dom) continue;

            currentBlocks.push({
              nodeKey: key,
              domElement: dom,
              fileId: node.getFileId(),
            });
          }

          setFileBlocks((prev) => mergeBlocks(prev, currentBlocks, destroyedKeys));
        });
      },
    );

    return removeListener;
  }, [editor]);

  // ── ImageNode mutation listener ────────────────────────────

  useEffect(() => {
    const removeListener = editor.registerMutationListener(
      ImageNode,
      (mutations) => {
        editor.getEditorState().read(() => {
          const currentBlocks: ImageBlockInfo[] = [];
          const destroyedKeys = new Set<string>();

          for (const [key, mutation] of mutations) {
            if (mutation === "destroyed") {
              destroyedKeys.add(key);
              continue;
            }

            const node = $getNodeByKey(key);
            if (!node || !$isImageNode(node)) continue;

            const dom = editor.getElementByKey(key);
            if (!dom) continue;

            currentBlocks.push({
              nodeKey: key,
              domElement: dom,
              src: node.getSrc(),
              alt: node.getAlt(),
              caption: node.getCaption(),
            });
          }

          setImageBlocks((prev) => mergeBlocks(prev, currentBlocks, destroyedKeys));
        });
      },
    );

    return removeListener;
  }, [editor]);

  // ── Initial scan on mount ──────────────────────────────────

  useEffect(() => {
    editor.getEditorState().read(() => {
      // AI Blocks
      const aiNodes = $nodesOfType(AIBlockNode);
      const aiBs: AIBlockInfo[] = [];
      for (const aiNode of aiNodes) {
        const key = aiNode.getKey();
        const dom = editor.getElementByKey(key);
        if (dom) {
          aiBs.push({
            nodeKey: key,
            domElement: dom,
            prompt: aiNode.getPrompt(),
            aiState: aiNode.getAIState(),
            result: aiNode.getResult(),
          });
        }
      }
      if (aiBs.length > 0) setAIBlocks(aiBs);

      // File Blocks
      const fileNodes = $nodesOfType(FileNode);
      const fileBs: FileBlockInfo[] = [];
      for (const fileNode of fileNodes) {
        const key = fileNode.getKey();
        const dom = editor.getElementByKey(key);
        if (dom) {
          fileBs.push({
            nodeKey: key,
            domElement: dom,
            fileId: fileNode.getFileId(),
          });
        }
      }
      if (fileBs.length > 0) setFileBlocks(fileBs);

      // Image Blocks
      const imageNodes = $nodesOfType(ImageNode);
      const imgBs: ImageBlockInfo[] = [];
      for (const imgNode of imageNodes) {
        const key = imgNode.getKey();
        const dom = editor.getElementByKey(key);
        if (dom) {
          imgBs.push({
            nodeKey: key,
            domElement: dom,
            src: imgNode.getSrc(),
            alt: imgNode.getAlt(),
            caption: imgNode.getCaption(),
          });
        }
      }
      if (imgBs.length > 0) setImageBlocks(imgBs);
    });
  }, [editor]);

  return (
    <>
      {/* AI Block portals */}
      {aiBlocks.map((block) =>
        createPortal(
          <AIBlockUI
            key={block.nodeKey}
            nodeKey={block.nodeKey}
            prompt={block.prompt}
            aiState={block.aiState}
            result={block.result}
          />,
          block.domElement,
        ),
      )}

      {/* File Block portals */}
      {fileBlocks.map((block) =>
        createPortal(
          <FileBlock
            key={block.nodeKey}
            nodeKey={block.nodeKey}
            fileId={block.fileId}
            entryId={entryId}
          />,
          block.domElement,
        ),
      )}

      {/* Image Block portals */}
      {imageBlocks.map((block) =>
        createPortal(
          <ImageBlock
            key={block.nodeKey}
            nodeKey={block.nodeKey}
            src={block.src}
            alt={block.alt}
            caption={block.caption}
          />,
          block.domElement,
        ),
      )}
    </>
  );
}
