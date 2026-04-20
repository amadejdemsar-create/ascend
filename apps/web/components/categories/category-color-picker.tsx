"use client";

import { Check } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CategoryColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function CategoryColorPicker({
  value,
  onChange,
}: CategoryColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_COLORS.map((color) => {
        const isSelected = value === color.value;
        return (
          <button
            key={color.value}
            type="button"
            title={color.label}
            aria-label={`Color: ${color.label}`}
            aria-pressed={isSelected}
            onClick={() => onChange(color.value)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              isSelected && "ring-2 ring-offset-2 ring-offset-background",
            )}
            style={{
              backgroundColor: color.value,
              ...(isSelected ? { ringColor: color.value } : {}),
            }}
          >
            {isSelected && <Check className="size-4 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
