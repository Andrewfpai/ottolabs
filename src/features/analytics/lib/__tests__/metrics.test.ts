import { describe, expect, it } from "vitest";

import { zonedInstant } from "@/lib/time/calendar-day";

import { buildInsights } from "../insights";
import {
  dailyTrend,
  dayPartTotals,
  hourProfile,
  kpis,
  lengthHistogram,
  medianSessionMs,
  peakWindow,
  sessionsStartedIn,
  streaks,
  taskStats,
  totalsByDay,
  trackShares,
  weekdayAverages,
  weeklyTotals,
} from "../metrics";
import { type SplittableSession, splitSessions } from "../split";

const TZ = "Asia/Jakarta";
const min = (n: number) => n * 60_000;

function session(day: string, time: string, minutes: number, trackId = "a"): SplittableSession {
  const startedAt = zonedInstant(day, time, TZ);
  return {
    startedAt,
    endedAt: new Date(startedAt.getTime() + min(minutes)),
    pausedMs: 0,
    trackId,
  };
}

const byDayOf = (sessions: SplittableSession[]) => totalsByDay(splitSessions(sessions, TZ, 4));

describe("dailyTrend", () => {
  it("fills empty days with zero and looks back past the range for the average", () => {
    const byDay = byDayOf([session("2026-09-25", "10:00", 70), session("2026-10-01", "10:00", 70)]);
    const trend = dailyTrend(byDay, { start: "2026-10-01", end: "2026-10-02" });
    expect(trend.map((p) => [p.day, p.ms / 60_000])).toEqual([
      ["2026-10-01", 70],
      ["2026-10-02", 0],
    ]);
    // 2026-10-01's week includes 2026-09-25: (70 + 70) / 7 = 20.
    expect(trend[0].averageMs / 60_000).toBeCloseTo(20);
    // 2026-10-02's week has dropped 09-25 but still holds 10-01.
    expect(trend[1].averageMs / 60_000).toBeCloseTo(10);
  });
});

describe("weeklyTotals", () => {
  it("groups days into weeks by the week-start setting", () => {
    const byDay = byDayOf([session("2026-09-28", "10:00", 30), session("2026-10-04", "10:00", 30)]);
    // Monday-start: 28 Sep and 4 Oct share a week. Sunday-start: they do not.
    expect(weeklyTotals(byDay, { start: "2026-09-28", end: "2026-10-04" }, 1)).toEqual([
      { weekStart: "2026-09-28", ms: min(60) },
    ]);
    expect(weeklyTotals(byDay, { start: "2026-09-28", end: "2026-10-04" }, 0)).toEqual([
      { weekStart: "2026-09-27", ms: min(30) },
      { weekStart: "2026-10-04", ms: min(30) },
    ]);
  });
});

describe("hourProfile and peakWindow", () => {
  it("finds the busiest two-hour stretch", () => {
    const slices = splitSessions(
      [session("2026-10-01", "21:30", 90), session("2026-10-02", "09:00", 30)],
      TZ,
      4,
    );
    const profile = hourProfile(slices, { start: "2026-10-01", end: "2026-10-02" });
    expect(profile[21] / 60_000).toBe(30);
    expect(profile[22] / 60_000).toBe(60);
    expect(peakWindow(profile)).toMatchObject({ startHour: 21, endHour: 23, ms: min(90) });
  });

  it("wraps around midnight", () => {
    const slices = splitSessions([session("2026-10-01", "23:00", 120)], TZ, 4);
    const profile = hourProfile(slices, { start: "2026-10-01", end: "2026-10-01" });
    expect(peakWindow(profile)).toMatchObject({ startHour: 23, endHour: 1, share: 1 });
  });

  it("has no peak without data", () => {
    expect(peakWindow(Array.from({ length: 24 }, () => 0))).toBeNull();
  });

  it("ignores slices outside the range", () => {
    const slices = splitSessions([session("2026-09-01", "10:00", 60)], TZ, 4);
    expect(hourProfile(slices, { start: "2026-10-01", end: "2026-10-02" })[10]).toBe(0);
  });
});

describe("trackShares", () => {
  it("ranks tracks by focus", () => {
    const slices = splitSessions(
      [session("2026-10-01", "10:00", 30, "a"), session("2026-10-01", "12:00", 90, "b")],
      TZ,
      4,
    );
    expect(trackShares(slices, { start: "2026-10-01", end: "2026-10-01" })).toEqual([
      { trackId: "b", ms: min(90), share: 0.75 },
      { trackId: "a", ms: min(30), share: 0.25 },
    ]);
  });
});

describe("session lengths", () => {
  const sessions = [10, 20, 50, 100, 200].map((m, i) => session("2026-10-01", `1${i}:00`, m));

  it("bins sessions by length", () => {
    expect(lengthHistogram(sessions).map((b) => b.count)).toEqual([1, 1, 0, 1, 0, 1, 1]);
  });

  it("takes the median", () => {
    expect(medianSessionMs(sessions)).toBe(min(50));
    expect(medianSessionMs([])).toBeNull();
  });
});

describe("kpis", () => {
  it("summarises the range", () => {
    const sessions = [
      session("2026-10-01", "10:00", 60),
      session("2026-10-01", "20:00", 30),
      session("2026-10-02", "10:00", 120),
      session("2026-09-01", "10:00", 600), // outside
    ];
    const range = { start: "2026-10-01", end: "2026-10-03" };
    const inRange = sessionsStartedIn(sessions, range, TZ, 4);
    const result = kpis(byDayOf(sessions), inRange, range);

    expect(result).toMatchObject({
      totalMs: min(210),
      sessionCount: 3,
      averageSessionMs: min(70),
      activeDays: 2,
      days: 3,
      bestDay: { day: "2026-10-02", ms: min(120) },
    });
  });
});

describe("streaks", () => {
  const days = (keys: string[]) => new Map(keys.map((k) => [k, min(30)]));

  it("does not break the current streak just because today is still empty", () => {
    expect(streaks(days(["2026-09-30", "2026-10-01"]), "2026-10-02")).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it("counts today once it has focus", () => {
    expect(streaks(days(["2026-10-01", "2026-10-02"]), "2026-10-02").current).toBe(2);
  });

  it("resets after a missed day and remembers the record", () => {
    const history = days(["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-02"]);
    expect(streaks(history, "2026-10-02")).toEqual({ current: 1, longest: 4 });
  });

  it("ignores a day with only seconds of focus", () => {
    const history = new Map([
      ["2026-10-01", 10_000],
      ["2026-09-30", min(30)],
    ]);
    expect(streaks(history, "2026-10-02").current).toBe(0);
  });
});

describe("weekdayAverages and dayPartTotals", () => {
  it("averages per occurrence of each weekday", () => {
    // Two Fridays in range, focus on one: average is half.
    const byDay = byDayOf([session("2026-10-02", "10:00", 60)]);
    const averages = weekdayAverages(byDay, { start: "2026-09-26", end: "2026-10-09" });
    expect(averages[5]).toBe(min(30));
  });

  it("buckets hours into parts of the day", () => {
    const profile = Array.from({ length: 24 }, () => 0);
    profile[9] = 10;
    profile[21] = 30;
    profile[1] = 5;
    expect(dayPartTotals(profile)).toEqual({ morning: 10, afternoon: 0, evening: 30, night: 5 });
  });
});

describe("taskStats", () => {
  const range = { start: "2026-10-01", end: "2026-10-07" };
  const at = (day: string, time: string | null) => zonedInstant(day, time, TZ);
  const base = {
    priority: "p3" as const,
    isAllDay: false,
    createdAt: at("2026-10-01", "09:00"),
  };

  it("separates on-time from late, and treats all-day deadlines as the whole day", () => {
    const stats = taskStats(
      [
        { ...base, status: "done", dueAt: at("2026-10-02", "12:00"), completedAt: at("2026-10-02", "11:00") },
        { ...base, status: "done", dueAt: at("2026-10-02", "12:00"), completedAt: at("2026-10-02", "13:00") },
        { ...base, status: "done", isAllDay: true, dueAt: at("2026-10-03", null), completedAt: at("2026-10-03", "23:00") },
        { ...base, status: "done", dueAt: null, completedAt: at("2026-10-03", "10:00") },
        { ...base, status: "todo", priority: "p1", dueAt: null, completedAt: null },
        { ...base, status: "in_progress", priority: "p2", dueAt: null, completedAt: null },
        { ...base, status: "cancelled", dueAt: null, completedAt: null },
      ],
      range,
      TZ,
    );
    expect(stats).toEqual({
      created: 7,
      completed: 4,
      onTime: 2,
      late: 1,
      openByPriority: { p1: 1, p2: 1, p3: 0 },
    });
  });
});

describe("buildInsights", () => {
  const baseKpis = {
    totalMs: min(600),
    sessionCount: 10,
    averageSessionMs: min(60),
    activeDays: 18,
    days: 30,
    bestDay: null,
  };
  const evening = Array.from({ length: 24 }, (_, h) => (h === 21 ? min(300) : h === 9 ? min(100) : 0));

  it("says nothing on too little data", () => {
    expect(
      buildInsights({
        kpis: { ...baseKpis, sessionCount: 2 },
        profile: evening,
        peak: null,
        weekdayAverages: [],
        medianSessionMs: null,
        topTracks: [],
        streaks: { current: 0, longest: 0 },
      }),
    ).toEqual([]);
  });

  it("explains the patterns in plain language", () => {
    const text = buildInsights({
      kpis: baseKpis,
      profile: evening,
      peak: { startHour: 21, endHour: 23, ms: min(300), share: 0.75 },
      weekdayAverages: [0, 0, 0, 0, min(100), 0, 0],
      medianSessionMs: min(48),
      topTracks: [
        { title: "Databases", share: 0.42 },
        { title: "Networking", share: 0.3 },
      ],
      streaks: { current: 5, longest: 9 },
    }).map((i) => i.text);

    expect(text).toEqual([
      "Your peak focus window is 21:00–23:00, with 75% of your focus.",
      "You focus 3.0× more in the evening than in the morning.",
      "Thursdays are your strongest day, averaging 1h 40m.",
      "Your typical session runs 48m.",
      "You focused on 18 of the last 30 days.",
      "Databases took 42% of your focus.",
      "You are on a 5-day streak. Your record is 9.",
    ]);
  });
});
