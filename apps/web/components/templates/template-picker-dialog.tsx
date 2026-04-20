"use client";

import { DynamicIcon } from "lucide-react/dynamic";
import type { IconName } from "lucide-react/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface Props<T extends Template> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: T[];
  title: string;
  description: string;
  onPick: (template: T) => void;
}

export function TemplatePickerDialog<T extends Template>({
  open,
  onOpenChange,
  templates,
  title,
  description,
  onPick,
}: Props<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onPick(t);
                onOpenChange(false);
              }}
              className="flex items-start gap-3 rounded-lg border border-border bg-primary/5 p-3 text-left hover:border-primary hover:bg-muted/50 transition-colors"
            >
              <div className="shrink-0 rounded-md bg-primary/10 p-2">
                <DynamicIcon
                  name={t.icon as IconName}
                  className="size-5 text-primary"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {t.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
