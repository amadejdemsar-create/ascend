"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryColorPicker } from "./category-color-picker";
import { CategoryIconPicker } from "./category-icon-picker";
import type { CreateCategoryInput } from "@/lib/validations";

interface CategoryData {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  parentId?: string | null;
}

interface CategoryFormProps {
  initialData?: CategoryData;
  categories?: CategoryData[];
  onSubmit: (data: CreateCategoryInput) => void;
  onCancel: () => void;
}

export function CategoryForm({
  initialData,
  categories,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const isEditMode = !!initialData;

  const [name, setName] = useState(initialData?.name ?? "");
  const [color, setColor] = useState(initialData?.color ?? "#4F46E5");
  const [icon, setIcon] = useState<string | undefined>(
    initialData?.icon ?? undefined,
  );
  const [parentId, setParentId] = useState<string | undefined>(
    initialData?.parentId ?? undefined,
  );

  // Filter out the current category (and its children) from parent options to avoid circular refs
  const parentOptions = categories?.filter((cat) => {
    if (!initialData) return true;
    return cat.id !== initialData.id;
  });

  const showParentSelect = parentOptions && parentOptions.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      color,
      icon,
      parentId,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category-name">Name</Label>
        <Input
          id="category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          required
          maxLength={100}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <CategoryColorPicker value={color} onChange={setColor} />
      </div>

      <div className="space-y-2">
        <Label>Icon</Label>
        <CategoryIconPicker value={icon} onChange={setIcon} />
      </div>

      {showParentSelect && (
        <div className="space-y-2">
          <Label>Parent Category</Label>
          <Select
            value={parentId ?? ""}
            onValueChange={(val) =>
              setParentId(val === "__none__" ? undefined : (val as string))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="None (top level)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None (top level)</SelectItem>
              {parentOptions.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {isEditMode ? "Save Changes" : "Create Category"}
        </Button>
      </div>
    </form>
  );
}
