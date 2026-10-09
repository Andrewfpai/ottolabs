/**
 * Storing and ringing task reminders. Not a "use server" file: the task
 * actions call it after they have authorised, and the cron route and the
 * heartbeat call the sender.
 */
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { taskReminders, tasks, userSettings } from "@/db/schema";
import { sendToUser } from "@/features/reminders/server/push";
import {
  normalizeOffsets,
  reminderFireAt,
  STALE_AFTER_MS,
  taskReminderMessage,
} from "@/features/tasks/lib/task-reminders";

/**
 * Replace a task's reminders, working out when each rings. Ones whose time
 * has already passed are stored as sent, so moving a deadline never fires a
 * burst of stale pings.
 */
export async function saveTaskReminders(input: {
  taskId: string;
  userId: string;
  offsets: readonly number[];
  dueAt: Date | null;
  isAllDay: boolean;
  timeZone: string;
}): Promise<void> {
  const offsets = normalizeOffsets(input.offsets);
  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.delete(taskReminders).where(eq(taskReminders.taskId, input.taskId));
    if (!input.dueAt || offsets.length === 0) return;
    await tx.insert(taskReminders).values(
      offsets.map((offsetMinutes) => {
        const fireAt = reminderFireAt({ dueAt: input.dueAt, isAllDay: input.isAllDay }, offsetMinutes, input.timeZone)!;
        return {
          taskId: input.taskId,
          userId: input.userId,
          offsetMinutes,
          fireAt,
          sentAt: fireAt.getTime() <= now ? new Date(now) : null,
        };
      }),
    );
  });
}

/** A task's current reminder offsets, furthest first. */
export async function taskReminderOffsets(taskId: string): Promise<number[]> {
  const rows = await db
    .select({ offset: taskReminders.offsetMinutes })
    .from(taskReminders)
    .where(eq(taskReminders.taskId, taskId));
  return normalizeOffsets(rows.map((r) => r.offset));
}

/**
 * Ring every reminder that is due. Each is claimed (marked sent) before it
 * is pushed, so two runs at once never send it twice. Reminders found more
 * than two hours late are dropped: nobody wants yesterday's "due in 1 hour".
 */
export async function runDueTaskReminders(now: number = Date.now()): Promise<{ sent: number; dropped: number }> {
  const result = { sent: 0, dropped: 0 };
  const due = await db
    .update(taskReminders)
    .set({ sentAt: new Date(now) })
    .where(
      and(
        isNull(taskReminders.sentAt),
        lte(taskReminders.fireAt, new Date(now)),
        inArray(
          taskReminders.taskId,
          db
            .select({ id: tasks.id })
            .from(tasks)
            .where(and(inArray(tasks.status, ["todo", "in_progress"]), sql`${tasks.dueAt} is not null`)),
        ),
      ),
    )
    .returning({ taskId: taskReminders.taskId, userId: taskReminders.userId, fireAt: taskReminders.fireAt });

  // Reminders on tasks that were finished or lost their deadline: never send them.
  await db
    .update(taskReminders)
    .set({ sentAt: new Date(now) })
    .where(and(isNull(taskReminders.sentAt), lte(taskReminders.fireAt, new Date(now))));

  for (const reminder of due) {
    if (now - reminder.fireAt.getTime() > STALE_AFTER_MS) {
      result.dropped += 1;
      continue;
    }
    const [task] = await db
      .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, isAllDay: tasks.isAllDay, timeZone: userSettings.timezone })
      .from(tasks)
      .innerJoin(userSettings, eq(userSettings.userId, tasks.userId))
      .where(eq(tasks.id, reminder.taskId))
      .limit(1);
    if (!task?.dueAt) continue;
    const delivered = await sendToUser(
      reminder.userId,
      taskReminderMessage({ taskId: task.id, title: task.title, dueAt: task.dueAt, isAllDay: task.isAllDay, now, timeZone: task.timeZone }),
    );
    if (delivered > 0) result.sent += 1;
  }
  return result;
}

let lastOpportunisticRun = 0;

/**
 * Run the sender from ordinary traffic too (the timer heartbeat), at most
 * once a minute per server instance. Keeps reminders close to on time even
 * between scheduler calls; the scheduler is what covers quiet hours.
 */
export async function maybeRunDueTaskReminders(): Promise<void> {
  const now = Date.now();
  if (now - lastOpportunisticRun < 60_000) return;
  lastOpportunisticRun = now;
  try {
    await runDueTaskReminders(now);
  } catch (error) {
    console.error("[task-reminders] run failed", error);
  }
}
