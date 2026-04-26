"use client";

/**
 * DecoratorPlugin: handles rendering of custom decorator nodes in the web layer.
 *
 * For Wave 3, WikiLinkNode and MentionNode use their createDOM() method
 * for rendering (styled via editor.css). Their text content is set by
 * Lexical's built-in text rendering.
 *
 * AIBlockNode rendering is handled separately: since it needs interactive
 * React UI (prompt input, generate button), we use Lexical's native
 * decorator system. AIBlockNode.decorate() returns null in the shared
 * @ascend/editor package, so we register a NodeTransform that wraps
 * the AIBlock DOM container with interactive controls via MutationObserver.
 *
 * In Wave 8, this will be replaced by proper React-based DecoratorNode
 * subclasses in the web layer, but for Wave 3 the DOM-based approach
 * works for the single-user case.
 *
 * This plugin is a no-op placeholder that ensures the import chain is
 * valid. The actual decorator rendering relies on:
 * 1. Node createDOM() + CSS (for WikiLink, Mention, Callout, Toggle)
 * 2. AIBlockUI is mounted when the user interacts with the AI Block
 *    via the slash menu (the $createAIBlockNode inserts the node,
 *    and we handle it via a mutation listener below).
 */

import { useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, $nodesOfType } from "lexical";
import { $isAIBlockNode, AIBlockNode } from "@ascend/editor";
import { createPortal } from "react-dom";
import { AIBlockUI } from "./ai-block-ui";

interface AIBlockInfo {
  nodeKey: string;
  domElement: HTMLElement;
  prompt: string;
  aiState: "idle" | "running" | "done";
  result: string | null;
}

export function DecoratorPlugin() {
  const [editor] = useLexicalComposerContext();
  const [aiBlocks, setAIBlocks] = useState<AIBlockInfo[]>([]);

  // Listen for AIBlockNode mutations to track which AI blocks exist
  useEffect(() => {
    const removeListener = editor.registerMutationListener(
      AIBlockNode,
      (mutations) => {
        editor.getEditorState().read(() => {
          const currentBlocks: AIBlockInfo[] = [];

          for (const [key, mutation] of mutations) {
            if (mutation === "destroyed") continue;

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

          setAIBlocks((prev) => {
            // Merge: keep existing entries, add new ones, remove destroyed ones
            const destroyedKeys = new Set<string>();
            for (const [key, mutation] of mutations) {
              if (mutation === "destroyed") destroyedKeys.add(key);
            }

            const kept = prev.filter((b) => !destroyedKeys.has(b.nodeKey));
            // Update existing entries with new data
            for (const newBlock of currentBlocks) {
              const existing = kept.findIndex(
                (b) => b.nodeKey === newBlock.nodeKey,
              );
              if (existing >= 0) {
                kept[existing] = newBlock;
              } else {
                kept.push(newBlock);
              }
            }
            return kept;
          });
        });
      },
    );

    return removeListener;
  }, [editor]);

  // Also scan for AIBlockNodes on initial mount
  useEffect(() => {
    editor.getEditorState().read(() => {
      const blocks: AIBlockInfo[] = [];
      const aiNodes = $nodesOfType(AIBlockNode);

      for (const aiNode of aiNodes) {
        const key = aiNode.getKey();
        const dom = editor.getElementByKey(key);
        if (dom) {
          blocks.push({
            nodeKey: key,
            domElement: dom,
            prompt: aiNode.getPrompt(),
            aiState: aiNode.getAIState(),
            result: aiNode.getResult(),
          });
        }
      }

      if (blocks.length > 0) {
        setAIBlocks(blocks);
      }
    });
  }, [editor]);

  return (
    <>
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
    </>
  );
}
