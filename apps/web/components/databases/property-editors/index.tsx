"use client";

import type { DatabaseField, DatabaseFieldConfig, DatabaseFieldType } from "@ascend/core";
import type { FormulaValue } from "@/lib/formula";
import { TextEditor } from "./text-editor";
import { NumberEditor } from "./number-editor";
import { DateEditor } from "./date-editor";
import { SelectEditor } from "./select-editor";
import { MultiSelectEditor } from "./multi-select-editor";
import { RelationEditor } from "./relation-editor";
import { FormulaDisplay } from "./formula-display";
import { UserEditor } from "./user-editor";
import { CheckboxEditor } from "./checkbox-editor";
import { RatingEditor } from "./rating-editor";
import { UrlEditor } from "./url-editor";
import { EmailEditor } from "./email-editor";
import { PhoneEditor } from "./phone-editor";
import { FileEditor } from "./file-editor";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface PropertyCellProps {
  field: DatabaseField;
  value: unknown;
  onChange: (next: unknown) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Extra props forwarded to specific editors. */
  editorProps?: Record<string, unknown>;
}

// ── Dispatcher ────────────────────────────────────────────────────────────

/**
 * Returns the appropriate editor component for a given field type.
 * This is useful when callers want to render the editor component directly
 * with full type safety.
 */
export function getPropertyEditor(fieldType: DatabaseFieldType) {
  switch (fieldType) {
    case "TEXT":
      return TextEditor;
    case "NUMBER":
      return NumberEditor;
    case "DATE":
      return DateEditor;
    case "SELECT":
      return SelectEditor;
    case "MULTI_SELECT":
      return MultiSelectEditor;
    case "RELATION":
      return RelationEditor;
    case "FORMULA":
      return FormulaDisplay;
    case "USER":
      return UserEditor;
    case "CHECKBOX":
      return CheckboxEditor;
    case "RATING":
      return RatingEditor;
    case "URL":
      return UrlEditor;
    case "EMAIL":
      return EmailEditor;
    case "PHONE":
      return PhoneEditor;
    case "FILE":
      return FileEditor;
    default:
      return null;
  }
}

/**
 * Universal property editor dispatcher.
 *
 * Routes to the correct editor component based on `field.type`. Callers pass
 * a single `<PropertyCell>` and the dispatcher handles type discrimination.
 *
 * Additional editor-specific props (resolvedEntries, onSearch, currentUser,
 * resolvedFiles, onAddOption, etc.) can be passed via the `editorProps` bag.
 */
export function PropertyCell({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
  editorProps = {},
}: PropertyCellProps) {
  switch (field.type) {
    case "TEXT":
      return (
        <TextEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "TEXT" }> }}
          value={value as string | null}
          onChange={onChange as (next: string | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    case "NUMBER":
      return (
        <NumberEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "NUMBER" }> }}
          value={value as number | null}
          onChange={onChange as (next: number | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    case "DATE":
      return (
        <DateEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "DATE" }> }}
          value={value as string | null}
          onChange={onChange as (next: string | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    case "SELECT":
      return (
        <SelectEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "SELECT" }> }}
          value={value as string | null}
          onChange={onChange as (next: string | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
          onAddOption={editorProps.onAddOption as ((label: string) => Promise<{ id: string }>) | undefined}
        />
      );
    case "MULTI_SELECT":
      return (
        <MultiSelectEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "MULTI_SELECT" }> }}
          value={value as string[] | null}
          onChange={onChange as (next: string[] | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
          onAddOption={editorProps.onAddOption as ((label: string) => Promise<{ id: string }>) | undefined}
        />
      );
    case "RELATION":
      return (
        <RelationEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "RELATION" }> }}
          value={value as string[] | null}
          onChange={onChange as (next: string[] | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
          resolvedEntries={editorProps.resolvedEntries as Array<{ id: string; title: string; databaseName?: string }> | undefined}
          onSearch={editorProps.onSearch as ((query: string) => Promise<Array<{ id: string; title: string; databaseName?: string }>>) | undefined}
        />
      );
    case "FORMULA":
      return (
        <FormulaDisplay
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "FORMULA" }> }}
          value={value as FormulaValue | null}
          onChange={onChange as (next: null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    case "USER":
      return (
        <UserEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "USER" }> }}
          value={value as string | null}
          onChange={onChange as (next: string | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
          currentUser={editorProps.currentUser as { id: string; name: string; email?: string; avatarUrl?: string } | undefined}
          availableUsers={editorProps.availableUsers as Array<{ id: string; name: string; email?: string; avatarUrl?: string }> | undefined}
        />
      );
    case "CHECKBOX":
      return (
        <CheckboxEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "CHECKBOX" }> }}
          value={value as boolean | null}
          onChange={onChange as (next: boolean | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    case "RATING":
      return (
        <RatingEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "RATING" }> }}
          value={value as number | null}
          onChange={onChange as (next: number | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    case "URL":
      return (
        <UrlEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "URL" }> }}
          value={value as string | null}
          onChange={onChange as (next: string | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    case "EMAIL":
      return (
        <EmailEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "EMAIL" }> }}
          value={value as string | null}
          onChange={onChange as (next: string | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    case "PHONE":
      return (
        <PhoneEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "PHONE" }> }}
          value={value as string | null}
          onChange={onChange as (next: string | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    case "FILE":
      return (
        <FileEditor
          field={field as DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "FILE" }> }}
          value={value as string[] | null}
          onChange={onChange as (next: string[] | null) => void}
          mode={mode}
          disabled={disabled}
          autoFocus={autoFocus}
          resolvedFiles={editorProps.resolvedFiles as Array<{ id: string; filename: string; mimeType?: string; sizeBytes?: number }> | undefined}
        />
      );
    default:
      return (
        <span className="text-muted-foreground text-sm px-1.5 py-1">
          Unknown field type
        </span>
      );
  }
}

// ── Re-exports ────────────────────────────────────────────────────────────

export { TextEditor } from "./text-editor";
export { NumberEditor } from "./number-editor";
export { DateEditor } from "./date-editor";
export { SelectEditor } from "./select-editor";
export { MultiSelectEditor } from "./multi-select-editor";
export { RelationEditor } from "./relation-editor";
export { FormulaDisplay } from "./formula-display";
export { UserEditor } from "./user-editor";
export { CheckboxEditor } from "./checkbox-editor";
export { RatingEditor } from "./rating-editor";
export { UrlEditor } from "./url-editor";
export { EmailEditor } from "./email-editor";
export { PhoneEditor } from "./phone-editor";
export { FileEditor } from "./file-editor";
