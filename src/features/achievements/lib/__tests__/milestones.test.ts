import { describe, expect, it } from "vitest";

import { ACCESSORIES } from "@/lib/avatars";

import {
  type AchievementStats,
  longestStreak,
  measureStats,
  metMilestones,
  MILESTONES,
  progressOf,
  progressText,
  type StatSession,
} from "../milestones";

const TZ = "Asia/Jakarta";
const H = 3_600_000;
const M = 60_000;

/** A finished session starting at a Jakarta wall-clock time. */
function session(isoLocal: string, focusMs: number, extra: Partial<StatSession> = {}): StatSession {
  const startedAt = new Date(`${isoLocal}+07:00`);
  return {
    trackId: "t",
    startedAt,
    endedAt: new Date(startedAt.getTime() + focusMs),
    pausedMs: 0,
    pausedAt: null,
    completedCycles: 0,
    roomId: null,
    ...extra,
  };
}

const settings = { timeZone: TZ, dayStartHour: 0, dailyGoalMinutes: 60 };
const NOW = new Date("2026-10-03T12:00:00Z").getTime();

describe("the milestone list", () => {
  it("rewards a different accessory for every milestone, all of them real", () => {
    const rewards = MILESTONES.map((m) => m.reward);
    expect(new Set(rewards).size).toBe(rewards.length);
    expect(rewards.every((r) => ACCESSORIES.some((a) => a.id === r))).toBe(true);
    expect(new Set(MILESTONES.map((m) => m.id)).size).toBe(MILESTONES.length);
  });
});

describe("longestStreak", () => {
  it("counts consecutive qualifying days only", () => {
    const byDay = new Map([
      ["2026-10-01", 30 * M],
      ["2026-10-02", 30 * M],
      ["2026-10-03", 10 * M], // too short: breaks the run
      ["2026-10-04", 30 * M],
      ["2026-10-05", 30 * M],
      ["2026-10-06", 30 * M],
    ]);
    expect(longestStreak(byDay, 25 * M)).toBe(3);
  });

  it("is zero with no qualifying day", () => {
    expect(longestStreak(new Map(), 25 * M)).toBe(0);
  });
});

describe("measureStats", () => {
  it("adds up focus, the longest sitting, cycles and room time", () => {
    const stats = measureStats({
      sessions: [
        session("2026-10-01T09:00:00", 2 * H, { completedCycles: 4 }),
        session("2026-10-02T09:00:00", 30 * M, { roomId: "r" }),
      ],
      tasksDone: 3,
      reviewsDone: 1,
      settings,
      now: NOW,
    });
    expect(stats.focusMs).toBe(2.5 * H);
    expect(stats.longestSessionMs).toBe(2 * H);
    expect(stats.pomodoroCycles).toBe(4);
    expect(stats.roomFocusMs).toBe(30 * M);
    expect(stats.longestStreakDays).toBe(2);
    // Only the 2-hour day reached the 60-minute goal.
    expect(stats.goalDays).toBe(1);
  });

  it("counts night-owl and early-bird sittings by local start time, 25 minutes or more", () => {
    const stats = measureStats({
      sessions: [
        session("2026-10-01T23:00:00", 30 * M),
        session("2026-10-02T02:30:00", 40 * M),
        session("2026-10-02T23:30:00", 10 * M), // too short
        session("2026-10-03T06:00:00", 30 * M),
        session("2026-10-03T08:00:00", 30 * M), // 08:00 is no longer early
      ],
      tasksDone: 0,
      reviewsDone: 0,
      settings,
      now: NOW,
    });
    expect(stats.nightOwlSessions).toBe(2);
    expect(stats.earlyBirdSessions).toBe(1);
  });
});

describe("progress", () => {
  const empty: AchievementStats = {
    focusMs: 0,
    longestStreakDays: 0,
    longestSessionMs: 0,
    pomodoroCycles: 0,
    goalDays: 0,
    tasksDone: 0,
    reviewsDone: 0,
    roomFocusMs: 0,
    nightOwlSessions: 0,
    earlyBirdSessions: 0,
  };

  it("reads as whole units against the target", () => {
    const fifty = MILESTONES.find((m) => m.id === "hours-50")!;
    const progress = progressOf(fifty, { ...empty, focusMs: 37.6 * H });
    expect(progressText(fifty, progress)).toBe("37 / 50 h");
    expect(progress.done).toBe(false);
  });

  it("unlocks exactly at the target and caps the bar", () => {
    const stats = { ...empty, focusMs: 60 * H, longestStreakDays: 7 };
    const met = metMilestones(stats).map((m) => m.id);
    expect(met).toEqual(expect.arrayContaining(["hours-10", "hours-50", "streak-7"]));
    expect(met).not.toContain("hours-150");
    expect(progressOf(MILESTONES[0], stats).ratio).toBe(1);
  });
});
