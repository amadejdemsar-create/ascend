/**
 * Shared todo helpers used by multiple components.
 */

/**
 * Returns true if a todo's due date is before today and the todo is
 * still pending. Used to highlight overdue todos in the list, detail,
 * and calendar views.
 */
export function isOverdue(dueDate: string | Date | null, status: string): boolean {
  if (!dueDate || status !== "PENDING") return false;
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}
