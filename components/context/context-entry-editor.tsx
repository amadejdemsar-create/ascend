"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface ContextEntryEditorProps {
  entryId?: string;
  onSave: (id: string) => void;
  onCancel: () => void;
}

export function ContextEntryEditor({
  entryId: _entryId,
  onSave: _onSave,
  onCancel: _onCancel,
}: ContextEntryEditorProps) {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
