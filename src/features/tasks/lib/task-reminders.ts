/**
 * Task reminders: "remind me 1 day before", "2 hours before", "at the
 * deadline". Each is an offset in minutes before the deadline. Pure, so the
 * arithmetic and the wording are tested.
 *
 * All-day deadlines have no time, so their reminders count back from 09:00 on
 * the due day: "1 day before" an all-day Friday task is Thursday at 09:00.
 */
import { addDays, type DayKey, dayKey, wallClock, zonedInstant } from "@/lib/time/calendar-day";

export const MAX_REMINDERS = 8;
/** Thirty days: further out than that is a calendar's job. */
export const MAX_OFFSET_MINUTES = 30 * 24 * 60;
/** When an all-day deadline "is", for counting back. */
export const ALL_DAY_REFERENCE = "09:00";
/** A reminder found later than this is dropped rather than sent stale. */
export const STALE_AFTER_MS = 2 * 3_600_000;

export const REMINDER_PRESETS = [0, 10, 30, 60, 120, 180, 1440, 2880, 10080] as const;

export type ReminderUnit = "minutes" | "hours" | "days" | "weeks";
export const UNIT_MINUTES: Record<ReminderUnit, number> = { minutes: 1, hours: 60, days: 1440, weeks: 10080 };

/** Unique, in range, at most eight, furthest-out first. */
export function normalizeOffsets(offsets: readonly number[]): number[] {
  const valid = offsets
    .filter((m) => Number.isInteger(m) && m >= 0 && m <= MAX_OFFSET_MINUTES)
    .sort((a, b) => b - a);
  return [...new Set(valid)].slice(0, MAX_REMINDERS);
}

/** "At the deadline", "30 minutes before", "2 hours before", "1 day before", "1 week before". */
export function describeOffset(minutes: number): string {
  if (minutes === 0) return "At the deadline";
  const units: [ReminderUnit, number][] = [
    ["weeks", 10080],
    ["days", 1440],
    ["hours", 60],
  ];
  for (const [unit, size] of units) {
    if (minutes % size === 0) {
      const n = minutes / size;
      return `${n} ${n === 1 ? unit.slice(0, -1) : unit} before`;
    }
  }
  if (minutes > 60) {
    const h = Math.floor(minutes / 60);
    return `${h} h ${minutes % 60} min before`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"} before`;
}

/** The instant a reminder rings, or null without a deadline. */
export function reminderFireAt(
  task: { dueAt: Date | null; isAllDay: boolean },
  offsetMinutes: number,
  timeZone: string,
): Date | null {
  if (!task.dueAt) return null;
  const reference = task.isAllDay
    ? zonedInstant(dayKey(task.dueAt, timeZone), ALL_DAY_REFERENCE, timeZone)
    : task.dueAt;
  return new Date(reference.getTime() - offsetMinutes * 60_000);
}

function dayWord(due: DayKey, today: DayKey): string | null {
  if (due === today) return "today";
  if (due === addDays(today, 1)) return "tomorrow";
  return null;
}

/** The push: what is due, and when, in your own time zone. */
export function taskReminderMessage(input: {
  taskId: string;
  title: string;
  dueAt: Date;
  isAllDay: boolean;
  now: number;
  timeZone: string;
}) {
  const today = dayKey(input.now, input.timeZone);
  const due = dayKey(input.dueAt, input.timeZone);
  const word = dayWord(due, today);
  const { hour, minute } = wallClock(input.dueAt, input.timeZone);
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  let when: string;
  if (input.isAllDay) {
    when = word ? `Due ${word}` : `Due ${due}`;
  } else {
    const minutesLeft = Math.round((input.dueAt.getTime() - input.now) / 60_000);
    if (minutesLeft <= 0) when = `Due now (${time})`;
    else if (minutesLeft < 60) when = `Due in ${minutesLeft} min, at ${time}`;
    else if (word) when = `Due ${word} at ${time}`;
    else when = `Due ${due} at ${time}`;
  }

  return { title: `⏰ ${input.title}`, body: `${when}.`, url: "/tasks", tag: `task-${input.taskId}` };
}
