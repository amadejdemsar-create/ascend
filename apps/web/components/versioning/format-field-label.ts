/**
 * Humanize camelCase field keys for diff display.
 *
 * Known keys get an explicit label; unknown keys fall back to
 * splitting on camelCase boundaries and capitalizing the first word.
 */

const LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  content: "Content",
  type: "Type",
  status: "Status",
  priority: "Priority",
  horizon: "Horizon",
  categoryId: "Category",
  parentId: "Parent",
  goalId: "Goal",
  startDate: "Start date",
  endDate: "End date",
  deadline: "Deadline",
  dueDate: "Due date",
  scheduledDate: "Scheduled",
  progress: "Progress",
  isPinned: "Pinned",
  tags: "Tags",
  sortOrder: "Sort order",
  isBig3: "Big 3",
  isRecurring: "Recurring",
  recurringPattern: "Recurrence pattern",
  blockDocumentId: "Block document",
  extractedText: "Extracted text",
  name: "Name",
  config: "Configuration",
  position: "Position",
  isPrimary: "Primary field",
};

export function formatFieldLabel(key: string): string {
  if (LABELS[key]) return LABELS[key];
  // Fallback: split camelCase, capitalize first word
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
