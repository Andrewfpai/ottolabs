import { describe, expect, it } from "vitest";

import { zonedInstant } from "@/lib/time/calendar-day";

import { agoLabel, memberState, roomActivity, roomTotals } from "../room";

const TZ = "Asia/Jakarta";
const NOW = zonedInstant("2026-10-02", "16:00", TZ).getTime(); // a Friday
const minutesAgo = (m: number) => new Date(NOW - m * 60_000);

describe("memberState", () => {
  const open = { endedAt: null, pausedAt: null, breakStartedAt: null, lastHeartbeatAt: minutesAgo(1) };

  it("reads focusing, paused and break from the open session", () => {
    expect(memberState(open, NOW)).toBe("focusing");
    expect(memberState({ ...open, pausedAt: minutesAgo(3) }, NOW)).toBe("paused");
    expect(memberState({ ...open, pausedAt: minutesAgo(3), breakStartedAt: minutesAgo(3) }, NOW)).toBe("break");
  });

  it("is away with no session, a finished one, or a silent heartbeat", () => {
    expect(memberState(null, NOW)).toBe("away");
    expect(memberState({ ...open, endedAt: minutesAgo(5) }, NOW)).toBe("away");
    expect(memberState({ ...open, lastHeartbeatAt: minutesAgo(45) }, NOW)).toBe("away");
    expect(memberState({ ...open, lastHeartbeatAt: null }, NOW)).toBe("away");
  });
});

describe("roomTotals", () => {
  const settings = { timeZone: TZ, dayStartHour: 4, weekStartsOn: 1 };
  const finished = (userId: string, day: string, time: string, minutes: number) => {
    const startedAt = zonedInstant(day, time, TZ);
    return {
      userId,
      trackId: "t",
      startedAt,
      endedAt: new Date(startedAt.getTime() + minutes * 60_000),
      pausedMs: 0,
    };
  };

  it("sums today and this week, per member", () => {
    const totals = roomTotals(
      [
        finished("a", "2026-10-02", "09:00", 60), // today
        finished("b", "2026-10-02", "10:00", 30), // today
        finished("a", "2026-09-29", "20:00", 45), // Tuesday this week
        finished("b", "2026-09-26", "20:00", 90), // last week
      ],
      settings,
      NOW,
    );
    expect(totals.todayMs).toBe(90 * 60_000);
    expect(totals.weekMs).toBe(135 * 60_000);
    expect(totals.weekByMember).toEqual({ a: 105 * 60_000, b: 30 * 60_000 });
  });

  it("counts a live session up to now, but not an abandoned one", () => {
    const live = {
      userId: "a",
      trackId: "t",
      startedAt: minutesAgo(20),
      endedAt: null,
      pausedMs: 0,
      lastHeartbeatAt: minutesAgo(1),
    };
    const abandoned = { ...live, userId: "b", lastHeartbeatAt: minutesAgo(60) };
    const totals = roomTotals([live, abandoned], settings, NOW);
    expect(totals.todayMs).toBe(20 * 60_000);
    expect(totals.weekByMember).toEqual({ a: 20 * 60_000 });
  });
});

describe("roomActivity", () => {
  const now = Date.UTC(2026, 9, 9, 12);
  const label = () => ({ title: "Databases", color: "violet" });

  it("lists starts and finishes from the last twelve hours, newest first", () => {
    const sessions = [
      { userId: "a", trackId: "t", startedAt: new Date(now - 3_600_000), endedAt: new Date(now - 600_000) },
      { userId: "b", trackId: "t", startedAt: new Date(now - 120_000), endedAt: null },
      { userId: "c", trackId: "t", startedAt: new Date(now - 20 * 3_600_000), endedAt: new Date(now - 19 * 3_600_000) },
    ];
    const events = roomActivity(sessions, label, () => 50 * 60_000, now);
    expect(events.map((e) => `${e.kind}:${e.userId}`)).toEqual(["start:b", "finish:a", "start:a"]);
    expect(events[1]).toMatchObject({ kind: "finish", focusMs: 50 * 60_000 });
  });
});

describe("agoLabel", () => {
  it("reads in minutes, then hours", () => {
    const now = Date.UTC(2026, 9, 9, 12);
    expect(agoLabel(now - 20_000, now)).toBe("just now");
    expect(agoLabel(now - 5 * 60_000, now)).toBe("5m ago");
    expect(agoLabel(now - 3 * 3_600_000, now)).toBe("3h ago");
  });
});
