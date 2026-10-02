/**
 * Where a task belongs on the list, and how its deadline reads.
 *
 * Pure functions of (task, now, zone) so that the server can group the list and
 * the tests can pin every boundary. Day boundaries are calendar days in the
 * user's zone — see `lib/time/calendar-day.ts` for why that is not the same as
 * the `dayStartHour` used by analytics.
 */
import type { Task } from "@/db/schema";
import {
  type DayKey,
  dayKey,
  daysBetween,
  formatDayKey,
  timeOfDay,
} from "@/lib/time/calendar-day";

export type TaskStatus = Task["status"];
export type TaskPriority = Task["priority"];

export function isOpen(status: TaskStatus): boolean {
  return status === "todo" || status === "in_progress";
}

type Dated = Pick<Task, "dueAt" | "isAllDay">;
type Sortable = Dated & Pick<Task, "priority" | "createdAt">;

export const OPEN_BUCKETS = ["overdue", "today", "upcoming", "someday"] as const;
export type OpenBucket = (typeof OPEN_BUCKETS)[number];

/**
 * Bucketed by the *day* the task is due, not the instant: a task due at 09:00
 * today is still in Today at 15:00, shown as late, rather than jumping to
 * Overdue alongside things that slipped last week.
 */
export function bucketFor(task: Dated, todayKey: DayKey, timeZone: string): OpenBucket {
  if (!task.dueAt) return "someday";
  const key = dayKey(task.dueAt, timeZone);
  if (key < todayKey) return "overdue";
  if (key === todayKey) return "today";
  return "upcoming";
}

/** Earliest deadline first; on a tie, higher priority, then oldest. */
function compareDated(a: Sortable, b: Sortable): number {
  const byDue = (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity);
  if (byDue !== 0) return byDue;
  // "p1" < "p2" < "p3" as strings, which is also the priority order.
  if (a.priority !== b.priority) return a.priority < b.priority ? -1 : 1;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/** No deadline to sort by: priority, then newest first. */
function compareUndated(a: Sortable, b: Sortable): number {
  if (a.priority !== b.priority) return a.priority < b.priority ? -1 : 1;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export function groupOpenTasks<T extends Sortable>(
  tasks: readonly T[],
  todayKey: DayKey,
  timeZone: string,
): Record<OpenBucket, T[]> {
  const groups: Record<OpenBucket, T[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    someday: [],
  };

  for (const task of tasks) groups[bucketFor(task, todayKey, timeZone)].push(task);

  groups.overdue.sort(compareDated);
  groups.today.sort(compareDated);
  groups.upcoming.sort(compareDated);
  groups.someday.sort(compareUndated);
  return groups;
}

export type DueTone = "overdue" | "today" | "soon" | "later";

export type DueDescription = {
  /** Short label for the list: "Tomorrow 14:30", "3 days overdue". */
  text: string;
  tone: DueTone;
  /** The full date, for a tooltip or screen reader. */
  full: string;
};

/**
 * How a deadline reads relative to `now`.
 *
 * Only meaningful for open tasks — a finished task is not "overdue".
 */
export function describeDue(
  task: Dated,
  now: number,
  timeZone: string,
): DueDescription | null {
  if (!task.dueAt) return null;

  const todayKey = dayKey(now, timeZone);
  const key = dayKey(task.dueAt, timeZone);
  const diff = daysBetween(todayKey, key);
  const time = task.isAllDay ? null : timeOfDay(task.dueAt, timeZone);
  const withTime = (label: string) => (time ? `${label} ${time}` : label);

  const sameYear = key.slice(0, 4) === todayKey.slice(0, 4);
  const full = withTime(
    formatDayKey(key, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  );

  if (diff < 0) {
    return {
      text: diff === -1 ? "Yesterday" : `${-diff} days overdue`,
      tone: "overdue",
      full,
    };
  }

  if (diff === 0) {
    // A timed deadline earlier today has passed; an all-day one has not.
    const late = !task.isAllDay && task.dueAt.getTime() < now;
    return { text: withTime("Today"), tone: late ? "overdue" : "today", full };
  }

  if (diff === 1) return { text: withTime("Tomorrow"), tone: "soon", full };

  if (diff < 7) {
    return { text: withTime(formatDayKey(key, { weekday: "short" })), tone: "soon", full };
  }

  return {
    text: withTime(
      formatDayKey(key, {
        day: "numeric",
        month: "short",
        ...(sameYear ? {} : { year: "numeric" }),
      }),
    ),
    tone: "later",
    full,
  };
}
