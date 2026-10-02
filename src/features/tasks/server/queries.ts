import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { type Task, tasks, tracks } from "@/db/schema";
import { groupOpenTasks, type OpenBucket } from "@/features/tasks/lib/due";
import { requireSettings, requireUser } from "@/lib/auth-guard";
import { type DayKey, dayKey } from "@/lib/time/calendar-day";

export type TaskWithTrack = Task & {
  track: { id: string; title: string; color: string; icon: string } | null;
};

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
  /**
   * The instant the board was grouped at. Components render relative labels
   * ("Tomorrow", "2 days overdue") against this rather than their own clock,
   * so the server render and hydration agree to the millisecond.
   */
  now: number;
  todayKey: DayKey;
  timeZone: string;
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

  const [openRows, closedRows] = await Promise.all([
    db
      .select({ task: tasks, track: trackShape })
      .from(tasks)
      .leftJoin(tracks, eq(tracks.id, tasks.trackId))
      .where(
        and(eq(tasks.userId, user.id), inArray(tasks.status, ["todo", "in_progress"]), byTrack),
      ),
    db
      .select({ task: tasks, track: trackShape })
      .from(tasks)
      .leftJoin(tracks, eq(tracks.id, tasks.trackId))
      .where(and(eq(tasks.userId, user.id), inArray(tasks.status, ["done", "cancelled"]), byTrack))
      .orderBy(desc(sql`coalesce(${tasks.completedAt}, ${tasks.updatedAt})`))
      .limit(RECENT_CLOSED_LIMIT),
  ]);

  const toTask = (row: (typeof openRows)[number]): TaskWithTrack => ({
    ...row.task,
    track: row.track,
  });

  const now = Date.now();
  const timeZone = settings.timezone;
  const todayKey = dayKey(now, timeZone);

  return {
    open: groupOpenTasks(openRows.map(toTask), todayKey, timeZone),
    closed: closedRows.map(toTask),
    now,
    todayKey,
    timeZone,
  };
}

/**
 * Tasks with a deadline in [from, to), for the calendar. Cancelled tasks are
 * left off — they are not going to happen, so they do not belong on a plan.
 */
export async function getTasksDueBetween(from: Date, to: Date): Promise<TaskWithTrack[]> {
  const user = await requireUser();

  const rows = await db
    .select({ task: tasks, track: trackShape })
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

  return rows.map((row) => ({ ...row.task, track: row.track }));
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
