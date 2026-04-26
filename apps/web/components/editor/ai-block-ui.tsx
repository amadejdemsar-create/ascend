"use client";

import { useState, useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, $createParagraphNode, $createTextNode, $isElementNode, type LexicalNode } from "lexical";
import { $isAIBlockNode, type AIBlockNode } from "@ascend/editor";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { SparklesIcon, Loader2Icon, XIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * AIBlockUI: interactive renderer for AIBlockNode.
 *
 * Shows a prompt textarea, generates content via POST /api/llm/chat,
 * and allows the user to insert the result as plain text blocks or
 * discard it.
 *
 * Wave 3: no streaming; full response returned at once.
 * Wave 8 may add SSE streaming.
 */

interface Props {
  nodeKey: string;
  prompt: string;
  aiState: "idle" | "running" | "done";
  result: string | null;
}

interface ChatResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  finishReason: string;
}

export function AIBlockUI({ nodeKey, prompt, aiState, result }: Props) {
  const [editor] = useLexicalComposerContext();
  const [localPrompt, setLocalPrompt] = useState(prompt);
  const [isGenerating, setIsGenerating] = useState(aiState === "running");
  const [generatedResult, setGeneratedResult] = useState<string | null>(result);

  const handleGenerate = useCallback(async () => {
    if (!localPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);

    // Update the node state to "running"
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node && $isAIBlockNode(node)) {
        (node as AIBlockNode).setPrompt(localPrompt);
        (node as AIBlockNode).setAIState("running");
      }
    });

    try {
      // Build context from surrounding blocks
      let contextText = "";
      editor.getEditorState().read(() => {
        const node = $getNodeByKey(nodeKey);
        if (node) {
          const parent = node.getParent();
          if (parent && $isElementNode(parent)) {
            const siblings: LexicalNode[] = parent.getChildren();
            const nodeIndex = siblings.indexOf(node);
            // Get up to 3 blocks before and after
            const start = Math.max(0, nodeIndex - 3);
            const end = Math.min(siblings.length, nodeIndex + 4);
            const context = siblings
              .slice(start, end)
              .filter((s: LexicalNode) => s !== node)
              .map((s: LexicalNode) => s.getTextContent())
              .filter(Boolean);
            contextText = context.join("\n\n");
          }
        }
      });

      const response = await apiFetch<ChatResponse>("/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({
          purpose: "ai_block",
          system:
            "You are a helpful writing assistant embedded in a block editor. " +
            "Generate content based on the user's prompt. Keep your response " +
            "focused and well-structured. Use markdown formatting.",
          messages: [
            ...(contextText
              ? [
                  {
                    role: "user" as const,
                    content: `Context from the surrounding document:\n\n${contextText}`,
                  },
                  {
                    role: "assistant" as const,
                    content:
                      "I see the surrounding context. What would you like me to write?",
                  },
                ]
              : []),
            { role: "user" as const, content: localPrompt },
          ],
          maxTokens: 2048,
        }),
      });

      setGeneratedResult(response.content);
      setIsGenerating(false);

      // Update the node state to "done"
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && $isAIBlockNode(node)) {
          (node as AIBlockNode).setAIState("done");
          (node as AIBlockNode).setResult(response.content);
        }
      });
    } catch (err) {
      setIsGenerating(false);
      console.error("[AIBlockUI] Generation failed:", err);
      toast.error(
        err instanceof Error ? err.message : "AI generation failed",
      );

      // Reset node state
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && $isAIBlockNode(node)) {
          (node as AIBlockNode).setAIState("idle");
        }
      });
    }
  }, [editor, nodeKey, localPrompt]);

  const handleInsert = useCallback(() => {
    if (!generatedResult) return;

    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!node) return;

      // Split the result into paragraphs and insert them
      const paragraphs = generatedResult.split("\n\n").filter(Boolean);
      let lastInserted = node;

      for (const text of paragraphs) {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(text));
        lastInserted.insertAfter(paragraph);
        lastInserted = paragraph;
      }

      // Remove the AI block
      node.remove();
    });
  }, [editor, nodeKey, generatedResult]);

  const handleDiscard = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        // Replace with an empty paragraph to maintain doc structure
        const paragraph = $createParagraphNode();
        node.insertAfter(paragraph);
        node.remove();
      }
    });
  }, [editor, nodeKey]);

  return (
    <div className="editor-ai-block-ui my-2 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <SparklesIcon className="size-4" aria-hidden="true" />
        <span>AI Block</span>
      </div>

      {!generatedResult && !isGenerating && (
        <div className="space-y-2">
          <Textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder="Describe what you want the AI to write..."
            className="min-h-[60px] text-sm resize-y"
            aria-label="AI prompt"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!localPrompt.trim()}
              aria-label="Generate AI content"
            >
              <SparklesIcon className="size-3.5 mr-1" aria-hidden="true" />
              Generate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDiscard}
              aria-label="Remove AI block"
            >
              <XIcon className="size-3.5 mr-1" aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          <span>Generating...</span>
        </div>
      )}

      {generatedResult && !isGenerating && (
        <div className="space-y-2">
          <div className="rounded-md bg-background p-3 text-sm whitespace-pre-wrap border">
            {generatedResult}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleInsert}
              aria-label="Insert generated content"
            >
              <CheckIcon className="size-3.5 mr-1" aria-hidden="true" />
              Insert as blocks
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDiscard}
              aria-label="Discard generated content"
            >
              <XIcon className="size-3.5 mr-1" aria-hidden="true" />
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
