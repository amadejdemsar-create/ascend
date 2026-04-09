"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface ContextEntryDetailProps {
  entryId: string;
  onClose: () => void;
  onEdit: () => void;
  onNavigate?: (id: string) => void;
  isMobileOverlay?: boolean;
}

export function ContextEntryDetail({
  entryId: _entryId,
  onClose: _onClose,
  onEdit: _onEdit,
  onNavigate: _onNavigate,
  isMobileOverlay: _isMobileOverlay,
}: ContextEntryDetailProps) {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
