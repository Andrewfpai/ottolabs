/**
 * Which days a calendar view covers, and where its arrows go.
 *
 * Everything is in day keys, so a view is the same set of dates no matter what
 * zone the server runs in. The page turns the first and last key into instants
 * using the user's zone only at the point of querying.
 */
import {
  addDays,
  type DayKey,
  formatDayKey,
  isDayKey,
  parseDayKey,
  weekdayOf,
} from "@/lib/time/calendar-day";

export const CALENDAR_VIEWS = ["month", "week", "agenda"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** How far ahead the agenda looks, and how far its arrows jump. */
export const AGENDA_DAYS = 28;

export type CalendarRange = {
  view: CalendarView;
  anchor: DayKey;
  /** First and last day shown, inclusive. */
  start: DayKey;
  end: DayKey;
  days: DayKey[];
  title: string;
  prev: DayKey;
  next: DayKey;
};

/** The URL for a view. Month and focus-off are the defaults, so they stay out of it. */
export function calendarHref(view: CalendarView, anchor: DayKey, showFocus: boolean): string {
  const params = new URLSearchParams();
  if (view !== "month") params.set("view", view);
  params.set("d", anchor);
  if (showFocus) params.set("focus", "1");
  return `/calendar?${params.toString()}`;
}

export function parseView(value: unknown): CalendarView {
  return CALENDAR_VIEWS.includes(value as CalendarView) ? (value as CalendarView) : "month";
}

export function parseAnchor(value: unknown, fallback: DayKey): DayKey {
  return typeof value === "string" && isDayKey(value) ? value : fallback;
}

export function startOfWeek(key: DayKey, weekStartsOn: number): DayKey {
  return addDays(key, -((weekdayOf(key) - weekStartsOn + 7) % 7));
}

function firstOfMonth(key: DayKey, monthOffset = 0): DayKey {
  const { year, month } = parseDayKey(key);
  const date = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  return date.toISOString().slice(0, 10);
}

/** "5 – 11 Oct 2026", "28 Sep – 4 Oct 2026", "29 Dec 2026 – 4 Jan 2027". */
export function formatSpan(start: DayKey, end: DayKey): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
  const from = formatDayKey(start, {
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" }),
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const to = formatDayKey(end, { day: "numeric", month: "short", year: "numeric" });
  return `${from} – ${to}`;
}

function enumerate(start: DayKey, end: DayKey): DayKey[] {
  const days: DayKey[] = [];
  for (let key = start; key <= end; key = addDays(key, 1)) days.push(key);
  return days;
}

export function calendarRange(
  view: CalendarView,
  anchor: DayKey,
  weekStartsOn: number,
): CalendarRange {
  if (view === "month") {
    const first = firstOfMonth(anchor);
    const last = addDays(firstOfMonth(anchor, 1), -1);
    // Whole weeks, so the grid has no ragged edges; the spill-over days from
    // the neighbouring months are shown dimmed.
    const start = startOfWeek(first, weekStartsOn);
    const end = addDays(startOfWeek(last, weekStartsOn), 6);
    return {
      view,
      anchor,
      start,
      end,
      days: enumerate(start, end),
      title: formatDayKey(first, { month: "long", year: "numeric" }),
      prev: firstOfMonth(anchor, -1),
      next: firstOfMonth(anchor, 1),
    };
  }

  if (view === "week") {
    const start = startOfWeek(anchor, weekStartsOn);
    const end = addDays(start, 6);
    return {
      view,
      anchor,
      start,
      end,
      days: enumerate(start, end),
      title: formatSpan(start, end),
      prev: addDays(anchor, -7),
      next: addDays(anchor, 7),
    };
  }

  const end = addDays(anchor, AGENDA_DAYS - 1);
  return {
    view,
    anchor,
    start: anchor,
    end,
    days: enumerate(anchor, end),
    title: formatSpan(anchor, end),
    prev: addDays(anchor, -AGENDA_DAYS),
    next: addDays(anchor, AGENDA_DAYS),
  };
}
