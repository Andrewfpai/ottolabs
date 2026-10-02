import { describe, expect, it } from "vitest";

import {
  addDays,
  dayKey,
  daysBetween,
  formatDayKey,
  isDayKey,
  timeOfDay,
  weekdayOf,
  zonedInstant,
} from "../calendar-day";

describe("dayKey", () => {
  // 20:00 UTC is already tomorrow in Jakarta and still today in New York.
  const instant = new Date("2026-10-02T20:00:00.000Z");

  it("reads the date in the given zone, not UTC", () => {
    expect(dayKey(instant, "Asia/Jakarta")).toBe("2026-10-03");
    expect(dayKey(instant, "America/New_York")).toBe("2026-10-02");
    expect(dayKey(instant, "UTC")).toBe("2026-10-02");
  });

  it("puts local midnight on the new day", () => {
    // 17:00 UTC is exactly 00:00 in Jakarta (UTC+7).
    expect(dayKey(new Date("2026-10-02T17:00:00.000Z"), "Asia/Jakarta")).toBe("2026-10-03");
    expect(dayKey(new Date("2026-10-02T16:59:59.999Z"), "Asia/Jakarta")).toBe("2026-10-02");
  });
});

describe("timeOfDay", () => {
  it("renders midnight as 00:00, never 24:00", () => {
    expect(timeOfDay(new Date("2026-10-02T17:00:00.000Z"), "Asia/Jakarta")).toBe("00:00");
  });

  it("uses the zone's wall clock", () => {
    expect(timeOfDay(new Date("2026-10-02T07:30:00.000Z"), "Asia/Jakarta")).toBe("14:30");
  });
});

describe("isDayKey", () => {
  it("accepts real dates", () => {
    expect(isDayKey("2026-10-02")).toBe(true);
    expect(isDayKey("2028-02-29")).toBe(true);
  });

  it("rejects impossible dates and other shapes", () => {
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2027-02-29")).toBe(false);
    expect(isDayKey("2026-13-01")).toBe(false);
    expect(isDayKey("2026-1-01")).toBe(false);
    expect(isDayKey("2026-10-02T00:00")).toBe(false);
    expect(isDayKey("")).toBe(false);
  });
});

describe("day arithmetic", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts calendar days across a DST change as whole days", () => {
    // US clocks spring forward on 2026-03-08; that day is 23 hours long.
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-03-09", "2026-03-07")).toBe(-2);
    expect(daysBetween("2026-10-02", "2026-10-02")).toBe(0);
  });

  it("knows the weekday", () => {
    expect(weekdayOf("2026-10-02")).toBe(5); // Friday
    expect(weekdayOf("2026-10-04")).toBe(0); // Sunday
  });
});

describe("zonedInstant", () => {
  it("places a wall-clock time in the zone", () => {
    expect(zonedInstant("2026-10-02", "14:30", "Asia/Jakarta").toISOString()).toBe(
      "2026-10-02T07:30:00.000Z",
    );
  });

  it("uses the start of the day when there is no time", () => {
    expect(zonedInstant("2026-10-02", null, "Asia/Jakarta").toISOString()).toBe(
      "2026-10-01T17:00:00.000Z",
    );
  });

  it.each([
    ["America/New_York", "2026-03-08"], // spring forward
    ["America/New_York", "2026-11-01"], // fall back
    ["Europe/London", "2026-03-29"],
    ["America/Santiago", "2026-09-06"], // DST starts at midnight: 00:00 does not exist
    ["Pacific/Kiritimati", "2026-10-02"], // UTC+14
    ["Asia/Jakarta", "2026-10-02"],
  ])("round-trips the day in %s on %s", (zone, key) => {
    expect(dayKey(zonedInstant(key, null, zone), zone)).toBe(key);
    expect(dayKey(zonedInstant(key, "23:59", zone), zone)).toBe(key);
  });

  it("moves a time skipped by DST forward rather than back a day", () => {
    // 02:30 does not exist in New York on 2026-03-08.
    const instant = zonedInstant("2026-03-08", "02:30", "America/New_York");
    expect(dayKey(instant, "America/New_York")).toBe("2026-03-08");
    expect(timeOfDay(instant, "America/New_York")).toBe("03:30");
  });
});

describe("formatDayKey", () => {
  it("formats the named date regardless of the host zone", () => {
    expect(formatDayKey("2026-10-02", { weekday: "short", day: "numeric", month: "short" })).toBe(
      "Fri 2 Oct",
    );
  });
});
