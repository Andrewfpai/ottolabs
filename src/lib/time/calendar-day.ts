/**
 * Calendar days in a named time zone, as "YYYY-MM-DD" keys.
 *
 * Deadlines are about the date on the wall where the user lives — not UTC, and
 * not whatever zone the server or browser happens to run in. Every task date is
 * turned into a key in the user's stored zone, and from then on it is plain
 * string comparison and UTC-based arithmetic, so a DST change can never make a
 * day 23 or 25 hours long and push a deadline into the wrong bucket.
 *
 * These are *calendar* days. Analytics day buckets are different: they honour
 * `dayStartHour`, so 01:00 work counts toward the night before. A deadline of
 * "Friday" is overdue at Friday midnight, not at 04:00 on Saturday.
 */
import { TZDate } from "@date-fns/tz";

export type DayKey = string;

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

// Intl.DateTimeFormat construction is comparatively expensive, and grouping a
// task list calls this once per task.
const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      // h23, not hour12:false — the latter renders midnight as "24" in some
      // engines.
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedParts(date: Date | number, timeZone: string) {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return parts;
}

/** The calendar day `date` falls on in `timeZone`. */
export function dayKey(date: Date | number, timeZone: string): DayKey {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Wall-clock "HH:mm" of `date` in `timeZone`. */
export function timeOfDay(date: Date | number, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.hour}:${p.minute}`;
}

export function parseDayKey(key: DayKey): { year: number; month: number; day: number } {
  const match = DAY_KEY_PATTERN.exec(key);
  if (!match) throw new Error(`Not a day key: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** True for a real date in YYYY-MM-DD form — "2026-02-30" is rejected. */
export function isDayKey(value: string): boolean {
  const match = DAY_KEY_PATTERN.exec(value);
  if (!match) return false;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return utc.toISOString().slice(0, 10) === value;
}

function keyToUtcMs(key: DayKey): number {
  const { year, month, day } = parseDayKey(key);
  return Date.UTC(year, month - 1, day);
}

export function addDays(key: DayKey, days: number): DayKey {
  return new Date(keyToUtcMs(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((keyToUtcMs(to) - keyToUtcMs(from)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key: DayKey): number {
  return new Date(keyToUtcMs(key)).getUTCDay();
}

/**
 * The instant at which `key` reaches `time` ("HH:mm") in `timeZone`, or the
 * start of that day when `time` is null.
 *
 * A time that does not exist because the clocks jump forward resolves to the
 * equivalent moment after the jump, which is what a person setting an alarm
 * for 02:30 on that night would expect.
 */
export function zonedInstant(key: DayKey, time: string | null, timeZone: string): Date {
  const { year, month, day } = parseDayKey(key);
  const [hours, minutes] = time ? time.split(":").map(Number) : [0, 0];
  return new Date(new TZDate(year, month - 1, day, hours, minutes, 0, timeZone).getTime());
}

/**
 * A local-midnight Date for `key`, for handing to date pickers, which work in
 * the browser's zone. Only the year, month and day of the result mean anything.
 */
export function dayKeyToLocalDate(key: DayKey): Date {
  const { year, month, day } = parseDayKey(key);
  return new Date(year, month - 1, day);
}

/** Inverse of `dayKeyToLocalDate`. */
export function localDateToDayKey(date: Date): DayKey {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Format a day key without dragging a time zone back in: the key is rendered
 * as a UTC date, which is exactly the date it names.
 */
export function formatDayKey(
  key: DayKey,
  options: Intl.DateTimeFormatOptions,
  locale = "en-GB",
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    keyToUtcMs(key),
  );
}
