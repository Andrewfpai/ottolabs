import { describe, expect, it } from "vitest";

import { zonedInstant } from "@/lib/time/calendar-day";
import { elapsedMs } from "@/lib/time/elapsed";

import { type SplittableSession, splitSession } from "../split";

const min = (n: number) => n * 60_000;

function session(
  zone: string,
  start: [string, string],
  end: [string, string],
  pausedMinutes = 0,
): SplittableSession {
  return {
    startedAt: zonedInstant(start[0], start[1], zone),
    endedAt: zonedInstant(end[0], end[1], zone),
    pausedMs: min(pausedMinutes),
    trackId: "track",
  };
}

/** Slices as [day, hour, minutes] for readable assertions. */
function shape(s: SplittableSession, zone: string, dayStartHour = 4) {
  return splitSession(s, zone, dayStartHour).map((x) => [x.day, x.hour, Math.round(x.ms / 60_000)]);
}

describe("splitSession", () => {
  const TZ = "Asia/Jakarta";

  it("splits across hour boundaries instead of crediting the start hour", () => {
    const s = session(TZ, ["2026-10-02", "21:30"], ["2026-10-02", "23:00"]);
    expect(shape(s, TZ)).toEqual([
      ["2026-10-02", 21, 30],
      ["2026-10-02", 22, 60],
    ]);
  });

  it("keeps a session inside one hour as one slice", () => {
    const s = session(TZ, ["2026-10-02", "10:05"], ["2026-10-02", "10:50"]);
    expect(shape(s, TZ)).toEqual([["2026-10-02", 10, 45]]);
  });

  it("spreads paused time evenly and still sums to elapsedMs", () => {
    const s = session(TZ, ["2026-10-02", "10:30"], ["2026-10-02", "11:30"], 20);
    expect(shape(s, TZ)).toEqual([
      ["2026-10-02", 10, 20],
      ["2026-10-02", 11, 20],
    ]);
    const total = splitSession(s, TZ, 4).reduce((sum, x) => sum + x.ms, 0);
    expect(total).toBeCloseTo(elapsedMs(s), 6);
  });

  it("splits a midnight crossing into two calendar days when the day starts at 00:00", () => {
    const s = session(TZ, ["2026-10-02", "23:30"], ["2026-10-03", "00:30"]);
    expect(shape(s, TZ, 0)).toEqual([
      ["2026-10-02", 23, 30],
      ["2026-10-03", 0, 30],
    ]);
  });

  it("keeps a midnight crossing on one focus day with the default 04:00 start", () => {
    const s = session(TZ, ["2026-10-02", "23:30"], ["2026-10-03", "00:30"]);
    expect(shape(s, TZ, 4)).toEqual([
      ["2026-10-02", 23, 30],
      ["2026-10-02", 0, 30],
    ]);
  });

  it("splits at the day-start boundary", () => {
    const s = session(TZ, ["2026-10-03", "03:30"], ["2026-10-03", "04:30"]);
    expect(shape(s, TZ, 4)).toEqual([
      ["2026-10-02", 3, 30],
      ["2026-10-03", 4, 30],
    ]);
  });

  it("follows the wall clock in a half-hour offset zone, not UTC hours", () => {
    // India is UTC+5:30, so 10:00–11:00 local spans two UTC hours.
    const s = session("Asia/Kolkata", ["2026-10-02", "10:00"], ["2026-10-02", "11:00"]);
    expect(shape(s, "Asia/Kolkata")).toEqual([["2026-10-02", 10, 60]]);
  });

  it("does not invent the hour skipped when clocks spring forward", () => {
    // New York skips 02:00–03:00 on 2026-03-08: 01:30 → 03:30 is one real hour.
    const NY = "America/New_York";
    const s = session(NY, ["2026-03-08", "01:30"], ["2026-03-08", "03:30"]);
    expect(shape(s, NY, 0)).toEqual([
      ["2026-03-08", 1, 30],
      ["2026-03-08", 3, 30],
    ]);
  });

  it("credits the repeated hour twice when clocks fall back", () => {
    // New York repeats 01:00–02:00 on 2026-11-01: 00:30 → 02:30 is three real hours.
    const NY = "America/New_York";
    const s = session(NY, ["2026-11-01", "00:30"], ["2026-11-01", "02:30"]);
    expect(shape(s, NY, 0)).toEqual([
      ["2026-11-01", 0, 30],
      ["2026-11-01", 1, 120],
      ["2026-11-01", 2, 30],
    ]);
  });

  it("measures a live session up to now", () => {
    const startedAt = zonedInstant("2026-10-02", "09:40", TZ);
    const now = zonedInstant("2026-10-02", "10:10", TZ).getTime();
    const live = { startedAt, endedAt: null, pausedMs: 0, trackId: "track" };
    expect(
      splitSession(live, TZ, 4, now).map((x) => [x.hour, Math.round(x.ms / 60_000)]),
    ).toEqual([
      [9, 20],
      [10, 10],
    ]);
  });

  it("returns nothing for a zero-length or fully paused session", () => {
    expect(splitSession(session(TZ, ["2026-10-02", "10:00"], ["2026-10-02", "10:00"]), TZ, 4)).toEqual([]);
    expect(
      splitSession(session(TZ, ["2026-10-02", "10:00"], ["2026-10-02", "10:30"], 30), TZ, 4),
    ).toEqual([]);
  });
});
