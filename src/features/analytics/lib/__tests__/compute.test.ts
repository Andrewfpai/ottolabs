import { describe, expect, it } from "vitest";

import { addDays, zonedInstant } from "@/lib/time/calendar-day";

import { computeAnalytics, computeFocusSummary } from "../compute";

const TZ = "Asia/Jakarta";
const NOW = zonedInstant("2026-10-02", "16:00", TZ).getTime();

function sessions() {
  const list = [];
  for (let d = 0; d < 120; d++) {
    if (d % 3 === 2) continue;
    const day = addDays("2026-10-02", -d);
    // One evening session per active day that crosses midnight now and then,
    // and a morning one on even days.
    const evening = zonedInstant(day, d % 5 === 0 ? "23:20" : "20:10", TZ);
    list.push({
      startedAt: evening,
      endedAt: new Date(evening.getTime() + 75 * 60_000),
      pausedMs: d % 4 === 0 ? 10 * 60_000 : 0,
      trackId: d % 2 ? "a" : "b",
    });
    if (d % 2 === 0) {
      const morning = zonedInstant(day, "08:45", TZ);
      list.push({
        startedAt: morning,
        endedAt: new Date(morning.getTime() + 40 * 60_000),
        pausedMs: 0,
        trackId: "a",
      });
    }
  }
  return list.filter((s) => s.endedAt.getTime() <= NOW);
}

describe("computeAnalytics", () => {
  const settings = { timeZone: TZ, dayStartHour: 4, weekStartsOn: 1 };
  const tracks = [
    { id: "a", title: "Databases", color: "teal" },
    { id: "b", title: "Networking", color: "sky" },
  ];

  it.each(["7d", "30d", "90d"] as const)("agrees with itself across views for %s", (rangeKey) => {
    const data = computeAnalytics({ rangeKey, settings, now: NOW, sessions: sessions(), tracks, tasks: [] });
    if (data.trend.kind !== "daily") throw new Error("expected a daily trend");

    const trendTotal = data.trend.points.reduce((sum, p) => sum + p.ms, 0);
    const hourTotal = data.hours.reduce((sum, ms) => sum + ms, 0);
    const trackTotal = data.tracks.reduce((sum, t) => sum + t.ms, 0);

    // The same focus, counted three ways, is the same number.
    expect(trendTotal).toBeCloseTo(data.kpis.totalMs, 3);
    expect(hourTotal).toBeCloseTo(data.kpis.totalMs, 3);
    expect(trackTotal).toBeCloseTo(data.kpis.totalMs, 3);
    expect(data.tracks.reduce((sum, t) => sum + t.share, 0)).toBeCloseTo(1, 6);
    expect(data.trend.points).toHaveLength(data.kpis.days);
  });

  it("switches to weekly totals for a year and keeps the total", () => {
    const data = computeAnalytics({ rangeKey: "1y", settings, now: NOW, sessions: sessions(), tracks, tasks: [] });
    if (data.trend.kind !== "weekly") throw new Error("expected a weekly trend");
    const weeklyTotal = data.trend.points.reduce((sum, p) => sum + p.ms, 0);
    expect(weeklyTotal).toBeCloseTo(data.kpis.totalMs, 3);
  });

  it("finds the evening peak", () => {
    const data = computeAnalytics({ rangeKey: "30d", settings, now: NOW, sessions: sessions(), tracks, tasks: [] });
    expect(data.peak?.startHour).toBe(20);
    expect(data.insights[0].text).toMatch(/^Your peak focus window is 20:00–22:00/);
  });

  it("names deleted tracks rather than dropping their time", () => {
    const data = computeAnalytics({
      rangeKey: "30d",
      settings,
      now: NOW,
      sessions: sessions(),
      tracks: [tracks[0]],
      tasks: [],
    });
    expect(data.tracks.map((t) => t.title).sort()).toEqual(["Databases", "Deleted track"]);
  });
});

describe("computeFocusSummary", () => {
  const settings = { timeZone: TZ, dayStartHour: 4, weekStartsOn: 1 };
  const at = (day: string, time: string, minutes: number, trackId = "a") => {
    const startedAt = zonedInstant(day, time, TZ);
    return { startedAt, endedAt: new Date(startedAt.getTime() + minutes * 60_000), pausedMs: 0, trackId };
  };

  it("splits today, this week and per-track week totals on focus days", () => {
    // NOW is Friday 2 Oct 16:00; the week (Monday start) began 28 Sep.
    const summary = computeFocusSummary({
      settings,
      now: NOW,
      sessions: [
        at("2026-10-02", "09:00", 60, "a"), // today
        at("2026-10-02", "02:00", 30, "b"), // 02:00 Friday is Thursday night's work
        at("2026-09-28", "10:00", 45, "b"), // Monday, this week
        at("2026-09-27", "22:00", 90, "a"), // Sunday, last week
      ],
    });

    expect(summary.todayKey).toBe("2026-10-02");
    expect(summary.weekStart).toBe("2026-09-28");
    expect(summary.todayMs).toBe(60 * 60_000);
    expect(summary.weekMs).toBe((60 + 30 + 45) * 60_000);
    expect(summary.weekByTrack).toEqual({ a: 60 * 60_000, b: 75 * 60_000 });
    expect(summary.recent.byDay["2026-09-27"]).toBe(90 * 60_000);
  });

  it("counts the current streak up to today", () => {
    const summary = computeFocusSummary({
      settings,
      now: NOW,
      sessions: ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"].map((d) => at(d, "10:00", 30)),
    });
    expect(summary.streaks).toEqual({ current: 4, longest: 4 });
  });
});
