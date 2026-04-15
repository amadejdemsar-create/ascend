"use client";

import { useState, useMemo } from "react";
import { DynamicIcon, iconNames } from "lucide-react/dynamic";
import type { IconName } from "lucide-react/dynamic";
import { Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CURATED_ICONS: IconName[] = [
  "folder",
  "briefcase",
  "user",
  "heart-pulse",
  "wallet",
  "book-open",
  "star",
  "target",
  "trophy",
  "zap",
  "flame",
  "globe",
  "code",
  "music",
  "camera",
  "pen-tool",
  "lightbulb",
  "rocket",
  "graduation-cap",
  "dumbbell",
];

const MAX_RESULTS = 50;

interface CategoryIconPickerProps {
  value: string | undefined;
  onChange: (icon: string) => void;
}

export function CategoryIconPicker({
  value,
  onChange,
}: CategoryIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return CURATED_ICONS;

    const term = search.toLowerCase().replace(/\s+/g, "-");
    return iconNames
      .filter((name) => name.includes(term))
      .slice(0, MAX_RESULTS);
  }, [search]);

  function handleSelect(icon: string) {
    onChange(icon);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className="w-full justify-start gap-2">
            {value ? (
              <>
                <DynamicIcon name={value as IconName} className="size-4" />
                <span className="truncate">{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Choose icon</span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-80 p-3" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="grid max-h-56 grid-cols-5 gap-1 overflow-y-auto">
          {filteredIcons.map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={`Icon: ${name}`}
              aria-pressed={value === name}
              onClick={() => handleSelect(name)}
              className={cn(
                "flex h-9 w-full items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                value === name &&
                  "bg-primary/10 ring-1 ring-primary",
              )}
            >
              <DynamicIcon name={name as IconName} className="size-5" />
            </button>
          ))}
          {filteredIcons.length === 0 && (
            <p className="col-span-5 py-4 text-center text-sm text-muted-foreground">
              No icons found
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
