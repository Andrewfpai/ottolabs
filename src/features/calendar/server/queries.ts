import { focusByDay, tasksByDay } from "@/features/calendar/lib/by-day";
import {
  type CalendarRange,
  calendarRange,
  type CalendarView,
  parseAnchor,
} from "@/features/calendar/lib/range";
import { getSessionsInRange } from "@/features/sessions/server/queries";
import { getTasksDueBetween, type TaskWithTrack } from "@/features/tasks/server/queries";
import { requireSettings } from "@/lib/auth-guard";
import { addDays, type DayKey, dayKey, zonedInstant } from "@/lib/time/calendar-day";

export type CalendarData = {
  range: CalendarRange;
  tasksByDay: Record<DayKey, TaskWithTrack[]>;
  /** Null when the focus overlay is switched off. */
  focusByDay: Record<DayKey, number> | null;
  /** Render relative states against this, not the client clock — see `TaskBoard.now`. */
  now: number;
  todayKey: DayKey;
  timeZone: string;
  weekStartsOn: 0 | 1;
  defaultReminders: number[];
};

export async function getCalendarData(options: {
  view: CalendarView;
  anchor: string | undefined;
  showFocus: boolean;
}): Promise<CalendarData> {
  const settings = await requireSettings();
  const timeZone = settings.timezone;
  const weekStartsOn = settings.weekStartsOn === 0 ? 0 : 1;

  const now = Date.now();
  const todayKey = dayKey(now, timeZone);
  const range = calendarRange(options.view, parseAnchor(options.anchor, todayKey), weekStartsOn);

  // The day keys become instants only here, in the user's zone.
  const from = zonedInstant(range.start, null, timeZone);
  const to = zonedInstant(addDays(range.end, 1), null, timeZone);

  // A focus day runs from dayStartHour to dayStartHour, so the session window
  // is the visible range shifted by that many hours.
  const dayStart = `${String(settings.dayStartHour).padStart(2, "0")}:00`;
  const sessionsFrom = zonedInstant(range.start, dayStart, timeZone);
  const sessionsTo = zonedInstant(addDays(range.end, 1), dayStart, timeZone);

  const [tasks, sessions] = await Promise.all([
    getTasksDueBetween(from, to),
    options.showFocus ? getSessionsInRange(sessionsFrom, sessionsTo) : Promise.resolve(null),
  ]);

  let focus: Record<DayKey, number> | null = null;
  if (sessions) {
    focus = {};
    // `getSessionsInRange` is inclusive at the far end; drop anything that
    // lands on the day after the range.
    for (const [key, ms] of Object.entries(focusByDay(sessions, timeZone, settings.dayStartHour))) {
      if (key >= range.start && key <= range.end) focus[key] = ms;
    }
  }

  return {
    range,
    tasksByDay: tasksByDay(tasks, timeZone),
    focusByDay: focus,
    now,
    todayKey,
    timeZone,
    weekStartsOn,
    defaultReminders: settings.defaultTaskReminders,
  };
}
