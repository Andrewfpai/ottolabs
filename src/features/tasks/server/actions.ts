"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { type Task, tasks, tracks } from "@/db/schema";
import {
  createTaskSchema,
  setTaskStatusSchema,
  taskIdSchema,
  updateTaskSchema,
} from "@/features/tasks/schema";
import { type ActionResult, fail, isForeignKeyViolation, ok } from "@/lib/action-result";
import { requireSettings, requireUser } from "@/lib/auth-guard";
import { zonedInstant } from "@/lib/time/calendar-day";

const TRACK_GONE = "That track no longer exists. Pick another or leave it empty.";
const TASK_GONE = "That task no longer exists.";

function revalidateTaskViews() {
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

/**
 * The track id comes from the client, so it is checked against the caller.
 * The foreign key alone would happily attach your task to someone else's track.
 */
async function ownsTrack(trackId: string | null, userId: string): Promise<boolean> {
  if (trackId === null) return true;
  const [row] = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)))
    .limit(1);
  return Boolean(row);
}

function deadline(dueDate: string | null, dueTime: string | null, timeZone: string) {
  if (dueDate === null) return { dueAt: null, isAllDay: false };
  return { dueAt: zonedInstant(dueDate, dueTime, timeZone), isAllDay: dueTime === null };
}

/**
 * Stamp `completedAt` on the way into done, keep the original stamp if it was
 * already done, and clear it on the way out. Done in SQL so that re-saving a
 * finished task from the edit form does not move its completion time.
 */
function completedAtFor(status: Task["status"]) {
  return status === "done" ? sql`coalesce(${tasks.completedAt}, now())` : null;
}

export async function createTask(input: unknown): Promise<ActionResult<Task>> {
  // Server Actions are reachable by direct POST; this authorises itself.
  const user = await requireUser();

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That does not look right.");
  }

  const { dueDate, dueTime, ...values } = parsed.data;
  if (!(await ownsTrack(values.trackId, user.id))) return fail(TRACK_GONE, "TRACK_NOT_FOUND");

  const settings = await requireSettings();

  try {
    const [created] = await db
      .insert(tasks)
      .values({ ...values, ...deadline(dueDate, dueTime, settings.timezone), userId: user.id })
      .returning();

    revalidateTaskViews();
    return ok(created);
  } catch (error) {
    // The track was deleted between the ownership check and the insert.
    if (isForeignKeyViolation(error)) return fail(TRACK_GONE, "TRACK_NOT_FOUND");
    throw error;
  }
}

export async function updateTask(input: unknown): Promise<ActionResult<Task>> {
  const user = await requireUser();

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That does not look right.");
  }

  const { id, dueDate, dueTime, ...values } = parsed.data;
  if (!(await ownsTrack(values.trackId, user.id))) return fail(TRACK_GONE, "TRACK_NOT_FOUND");

  const settings = await requireSettings();

  try {
    const [updated] = await db
      .update(tasks)
      .set({
        ...values,
        ...deadline(dueDate, dueTime, settings.timezone),
        completedAt: completedAtFor(values.status),
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
      .returning();

    if (!updated) return fail(TASK_GONE, "NOT_FOUND");

    revalidateTaskViews();
    return ok(updated);
  } catch (error) {
    if (isForeignKeyViolation(error)) return fail(TRACK_GONE, "TRACK_NOT_FOUND");
    throw error;
  }
}

export async function setTaskStatus(input: unknown): Promise<ActionResult<Task>> {
  const user = await requireUser();

  const parsed = setTaskStatusSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown task.");

  const { id, status } = parsed.data;

  const [updated] = await db
    .update(tasks)
    .set({ status, completedAt: completedAtFor(status), updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .returning();

  if (!updated) return fail(TASK_GONE, "NOT_FOUND");

  revalidateTaskViews();
  return ok(updated);
}

export async function deleteTask(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = taskIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown task.");

  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, parsed.data.id), eq(tasks.userId, user.id)))
    .returning({ id: tasks.id });

  if (deleted.length === 0) return fail(TASK_GONE, "NOT_FOUND");

  revalidateTaskViews();
  return ok(undefined);
}
