"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff, Key } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

export function ApiKeySection() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(API_KEY).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const maskedKey = API_KEY
    ? API_KEY.slice(0, 6) + "\u2022".repeat(Math.max(0, API_KEY.length - 10)) + API_KEY.slice(-4)
    : "Not configured";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="size-4 text-muted-foreground" />
          API Key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Use this key to connect AI assistants to Ascend via MCP. See the{" "}
          <a href="/docs#mcp-integration" className="text-primary underline hover:no-underline">
            documentation
          </a>{" "}
          for setup instructions.
        </p>

        {API_KEY ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm select-all">
              {visible ? API_KEY : maskedKey}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? "Hide API key" : "Show API key"}
            >
              {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              aria-label="Copy API key"
            >
              {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-destructive">
            No API key configured. Set the NEXT_PUBLIC_API_KEY environment variable.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
