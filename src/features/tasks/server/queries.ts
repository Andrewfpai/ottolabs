import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { focusSessions, type Task, taskReminders, tasks, tracks } from "@/db/schema";
import { groupOpenTasks, type OpenBucket } from "@/features/tasks/lib/due";
import { FOCUS_MS } from "@/features/tracks/server/queries";
import { requireSettings, requireUser } from "@/lib/auth-guard";
import { addDays, type DayKey, dayKey, zonedInstant } from "@/lib/time/calendar-day";

export type TaskWithTrack = Task & {
  track: { id: string; title: string; color: string; icon: string } | null;
  /** Reminder offsets in minutes before the deadline, furthest first. */
  reminders: number[];
};

/** A task's reminder offsets, as one array column. */
const reminderOffsets = sql<number[] | null>`(select array_agg(${taskReminders.offsetMinutes} order by ${taskReminders.offsetMinutes} desc) from ${taskReminders} where ${taskReminders.taskId} = ${tasks.id})`;

const trackShape = {
  id: tracks.id,
  title: tracks.title,
  color: tracks.color,
  icon: tracks.icon,
};

/** How many finished tasks the Done section shows. */
const RECENT_CLOSED_LIMIT = 30;

/** `"none"` means tasks with no track; a uuid means that track. */
export type TaskTrackFilter = string | "none" | undefined;

export type TaskBoard = {
  open: Record<OpenBucket, TaskWithTrack[]>;
  /** Done and cancelled, most recently closed first. */
  closed: TaskWithTrack[];
  /** Finished tasks with a review due today or overdue, oldest due first. */
  reviews: TaskWithTrack[];
  /**
   * The instant the board was grouped at. Components render relative labels
   * ("Tomorrow", "2 days overdue") against this rather than their own clock,
   * so the server render and hydration agree to the millisecond.
   */
  now: number;
  todayKey: DayKey;
  timeZone: string;
  /** Reminders a new task starts with (Settings). */
  defaultReminders: number[];
};

function trackCondition(filter: TaskTrackFilter) {
  if (filter === "none") return isNull(tasks.trackId);
  if (filter) return eq(tasks.trackId, filter);
  return undefined;
}

export async function getTaskBoard(options?: { trackId?: TaskTrackFilter }): Promise<TaskBoard> {
  const user = await requireUser();
  const settings = await requireSettings();
  const byTrack = trackCondition(options?.trackId);

  const now = Date.now();
  const timeZone = settings.timezone;
  const todayKey = dayKey(now, timeZone);
  const tomorrowStart = zonedInstant(addDays(todayKey, 1), null, timeZone);

  const [openRows, closedRows, reviewRows] = await Promise.all([
    db
      .select({ task: tasks, track: trackShape, reminders: reminderOffsets })
      .from(tasks)
      .leftJoin(tracks, eq(tracks.id, tasks.trackId))
      .where(
        and(eq(tasks.userId, user.id), inArray(tasks.status, ["todo", "in_progress"]), byTrack),
      ),
    db
      .select({ task: tasks, track: trackShape, reminders: reminderOffsets })
      .from(tasks)
      .leftJoin(tracks, eq(tracks.id, tasks.trackId))
      .where(and(eq(tasks.userId, user.id), inArray(tasks.status, ["done", "cancelled"]), byTrack))
      .orderBy(desc(sql`coalesce(${tasks.completedAt}, ${tasks.updatedAt})`))
      .limit(RECENT_CLOSED_LIMIT),
    db
      .select({ task: tasks, track: trackShape, reminders: reminderOffsets })
      .from(tasks)
      .leftJoin(tracks, eq(tracks.id, tasks.trackId))
      .where(
        and(
          eq(tasks.userId, user.id),
          eq(tasks.status, "done"),
          sql`${tasks.reviewStage} > 0`,
          lt(tasks.reviewDueAt, tomorrowStart),
          byTrack,
        ),
      )
      .orderBy(tasks.reviewDueAt),
  ]);

  const toTask = (row: (typeof openRows)[number]): TaskWithTrack => ({
    ...row.task,
    track: row.track,
    // An int[] aggregate; `sql<T>` is only a cast (AGENTS rule 8), so coerce.
    reminders: (row.reminders ?? []).map(Number),
  });

  return {
    open: groupOpenTasks(openRows.map(toTask), todayKey, timeZone),
    closed: closedRows.map(toTask),
    reviews: reviewRows.map(toTask),
    now,
    todayKey,
    timeZone,
    defaultReminders: settings.defaultTaskReminders,
  };
}

/**
 * Tasks with a deadline in [from, to), for the calendar. Cancelled tasks are
 * left off — they are not going to happen, so they do not belong on a plan.
 */
export async function getTasksDueBetween(from: Date, to: Date): Promise<TaskWithTrack[]> {
  const user = await requireUser();

  const rows = await db
    .select({ task: tasks, track: trackShape, reminders: reminderOffsets })
    .from(tasks)
    .leftJoin(tracks, eq(tracks.id, tasks.trackId))
    .where(
      and(
        eq(tasks.userId, user.id),
        ne(tasks.status, "cancelled"),
        gte(tasks.dueAt, from),
        lt(tasks.dueAt, to),
      ),
    );

  return rows.map((row) => ({ ...row.task, track: row.track, reminders: (row.reminders ?? []).map(Number) }));
}

/** The fields task statistics need, for every task the user has. */
export async function getTasksForStats() {
  const user = await requireUser();

  return db
    .select({
      status: tasks.status,
      priority: tasks.priority,
      dueAt: tasks.dueAt,
      isAllDay: tasks.isAllDay,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .where(eq(tasks.userId, user.id));
}

/** An open task as a track card lists it. */
export type TrackTask = Pick<Task, "id" | "title" | "status" | "priority" | "dueAt" | "isAllDay"> & {
  /** Finished focus time recorded against the task. */
  focusMs: number;
};

/**
 * Every open task filed under a track, grouped by track, with the time
 * already put into each. In progress first, then by deadline (none last),
 * then priority — the order you would pick the next one in.
 */
export async function getOpenTasksByTrack(): Promise<Record<string, TrackTask[]>> {
  const user = await requireUser();

  const rows = await db
    .select({
      trackId: tasks.trackId,
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueAt: tasks.dueAt,
      isAllDay: tasks.isAllDay,
      focusMs: FOCUS_MS,
    })
    .from(tasks)
    .leftJoin(
      focusSessions,
      and(eq(focusSessions.taskId, tasks.id), sql`${focusSessions.endedAt} is not null`),
    )
    .where(
      and(
        eq(tasks.userId, user.id),
        inArray(tasks.status, ["todo", "in_progress"]),
        sql`${tasks.trackId} is not null`,
      ),
    )
    .groupBy(tasks.id)
    .orderBy(
      sql`${tasks.status} = 'in_progress' desc`,
      sql`${tasks.dueAt} asc nulls last`,
      tasks.priority,
      tasks.sortOrder,
      tasks.createdAt,
    );

  const byTrack: Record<string, TrackTask[]> = {};
  for (const { trackId, focusMs, ...task } of rows) {
    if (!trackId) continue;
    // Postgres returns numeric aggregates as strings.
    (byTrack[trackId] ??= []).push({ ...task, focusMs: Math.max(0, Math.round(Number(focusMs))) });
  }
  return byTrack;
}
