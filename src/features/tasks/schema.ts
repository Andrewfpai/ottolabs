import { z } from "zod";

import type { Task } from "@/db/schema";
import { MAX_OFFSET_MINUTES, MAX_REMINDERS } from "@/features/tasks/lib/task-reminders";
import { isDayKey } from "@/lib/time/calendar-day";

// Spelled out rather than read from the pgEnums so this file, which the task
// form imports, does not drag the Drizzle schema into the client bundle.
// `satisfies` keeps them from drifting apart.
export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "done",
  "cancelled",
] as const satisfies readonly Task["status"][];

export const TASK_PRIORITIES = ["p1", "p2", "p3"] as const satisfies readonly Task["priority"][];

const dueDate = z.string().refine(isDayKey, "Pick a real date").nullable().default(null);

const dueTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 14:30")
  .nullable()
  .default(null);

/**
 * The deadline travels as a calendar date plus an optional wall-clock time, not
 * as an instant. The server turns it into one using the zone stored in
 * settings — the same zone the list is grouped in — so the browser's own zone
 * never gets a vote. No time means an all-day deadline.
 */
const taskFields = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the task a title")
    .max(200, "Keep the title under 200 characters"),
  notes: z
    .string()
    .trim()
    .max(2000, "Keep the notes under 2000 characters")
    .nullish()
    .transform((value) => (value ? value : null)),
  trackId: z.uuid().nullable().default(null),
  priority: z.enum(TASK_PRIORITIES).default("p3"),
  dueDate,
  dueTime,
  /** Minutes before the deadline. Omitted on create means "my defaults"; on update, "unchanged". */
  reminders: z.array(z.number().int().min(0).max(MAX_OFFSET_MINUTES)).max(MAX_REMINDERS).optional(),
});

export const defaultRemindersSchema = z.object({
  reminders: z.array(z.number().int().min(0).max(MAX_OFFSET_MINUTES)).max(MAX_REMINDERS),
});

const timeNeedsDate = {
  check: (v: { dueDate: string | null; dueTime: string | null }) =>
    v.dueTime === null || v.dueDate !== null,
  message: { message: "Pick a date for that time", path: ["dueTime"] },
};

export const createTaskSchema = taskFields.refine(timeNeedsDate.check, timeNeedsDate.message);

export const updateTaskSchema = taskFields
  .extend({ id: z.uuid(), status: z.enum(TASK_STATUSES) })
  .refine(timeNeedsDate.check, timeNeedsDate.message);

export const setTaskStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(TASK_STATUSES),
});

export const taskIdSchema = z.object({ id: z.uuid() });

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
