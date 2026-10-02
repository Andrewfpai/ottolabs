/**
 * Display names and colours for task enums.
 *
 * Classes are spelled out in full because Tailwind cannot see class names
 * assembled at runtime. Orange is the Start button's alone, so high priority is
 * the destructive red and medium is the warning amber.
 */
import type { DueTone, TaskPriority, TaskStatus } from "@/features/tasks/lib/due";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  p1: { label: "High", className: "text-destructive" },
  p2: { label: "Medium", className: "text-warning" },
  p3: { label: "Low", className: "text-muted-foreground" },
};

export const DUE_TONE_CLASSES: Record<DueTone, string> = {
  overdue: "text-destructive",
  today: "text-primary",
  soon: "text-foreground",
  later: "text-muted-foreground",
};
