import { describe, expect, it } from "vitest";

import { zonedInstant } from "@/lib/time/calendar-day";

import { focusByDay, tasksByDay } from "../by-day";
import { calendarRange, formatSpan, parseAnchor, parseView, startOfWeek } from "../range";

const TZ = "Asia/Jakarta";

describe("startOfWeek", () => {
  it("honours the week start setting", () => {
    // 2026-10-02 is a Friday.
    expect(startOfWeek("2026-10-02", 1)).toBe("2026-09-28"); // Monday
    expect(startOfWeek("2026-10-02", 0)).toBe("2026-09-27"); // Sunday
    expect(startOfWeek("2026-09-28", 1)).toBe("2026-09-28");
    expect(startOfWeek("2026-09-27", 1)).toBe("2026-09-21");
  });
});

describe("calendarRange", () => {
  it("pads a month out to whole weeks", () => {
    const range = calendarRange("month", "2026-10-15", 1);
    expect(range.start).toBe("2026-09-28");
    expect(range.end).toBe("2026-11-01");
    expect(range.days).toHaveLength(35);
    expect(range.title).toBe("October 2026");
    expect(range.prev).toBe("2026-09-01");
    expect(range.next).toBe("2026-11-01");
  });

  it("steps months across a year end", () => {
    const range = calendarRange("month", "2026-12-31", 1);
    expect(range.next).toBe("2027-01-01");
    expect(calendarRange("month", "2027-01-05", 1).prev).toBe("2026-12-01");
  });

  it("covers the week containing the anchor", () => {
    const range = calendarRange("week", "2026-10-02", 1);
    expect(range.days).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(range.title).toBe("28 Sep – 4 Oct 2026");
    expect(range.prev).toBe("2026-09-25");
  });

  it("runs the agenda four weeks from the anchor", () => {
    const range = calendarRange("agenda", "2026-10-02", 1);
    expect(range.start).toBe("2026-10-02");
    expect(range.end).toBe("2026-10-29");
    expect(range.next).toBe("2026-10-30");
  });
});

describe("formatSpan", () => {
  it("drops what the two ends share", () => {
    expect(formatSpan("2026-10-05", "2026-10-11")).toBe("5 – 11 Oct 2026");
    expect(formatSpan("2026-09-28", "2026-10-04")).toBe("28 Sep – 4 Oct 2026");
    expect(formatSpan("2026-12-28", "2027-01-03")).toBe("28 Dec 2026 – 3 Jan 2027");
  });
});

describe("URL parsing", () => {
  it("falls back on anything it does not recognise", () => {
    expect(parseView("week")).toBe("week");
    expect(parseView("year")).toBe("month");
    expect(parseView(undefined)).toBe("month");
    expect(parseAnchor("2026-02-30", "2026-10-02")).toBe("2026-10-02");
    expect(parseAnchor(["2026-10-09"], "2026-10-02")).toBe("2026-10-02");
    expect(parseAnchor("2026-10-09", "2026-10-02")).toBe("2026-10-09");
  });
});

describe("tasksByDay", () => {
  const task = (key: string, time: string | null, priority: "p1" | "p3" = "p3") => ({
    id: `${key}-${time}-${priority}`,
    dueAt: zonedInstant(key, time, TZ),
    isAllDay: time === null,
    priority,
    createdAt: new Date("2026-09-01T00:00:00Z"),
  });

  it("files tasks under their local due day, all-day first", () => {
    const late = task("2026-10-02", "23:30");
    const allDay = task("2026-10-02", null);
    const early = task("2026-10-02", "08:00");
    const byDay = tasksByDay([late, allDay, early], TZ);
    expect(Object.keys(byDay)).toEqual(["2026-10-02"]);
    expect(byDay["2026-10-02"]).toEqual([allDay, early, late]);
  });

  it("drops tasks without a deadline", () => {
    const undated = { ...task("2026-10-02", null), dueAt: null };
    expect(tasksByDay([undated], TZ)).toEqual({});
  });
});

describe("focusByDay", () => {
  const session = (key: string, time: string, minutes: number, pausedMinutes = 0) => {
    const startedAt = zonedInstant(key, time, TZ);
    return {
      startedAt,
      endedAt: new Date(startedAt.getTime() + minutes * 60_000),
      pausedMs: pausedMinutes * 60_000,
    };
  };

  it("sums focus, excluding pauses, per day", () => {
    const byDay = focusByDay(
      [session("2026-10-02", "09:00", 60, 10), session("2026-10-02", "20:00", 30)],
      TZ,
      4,
    );
    expect(byDay).toEqual({ "2026-10-02": 80 * 60_000 });
  });

  it("puts a session before the day-start hour on the night before", () => {
    const byDay = focusByDay([session("2026-10-03", "01:30", 45)], TZ, 4);
    expect(byDay).toEqual({ "2026-10-02": 45 * 60_000 });
  });
});
