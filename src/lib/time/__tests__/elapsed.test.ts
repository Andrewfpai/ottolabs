import { describe, expect, it } from "vitest";

import {
  elapsedMs,
  formatCompact,
  formatDuration,
  isPaused,
  pausedTotalMs,
  spanMs,
  timerState,
} from "../elapsed";

const T0 = new Date("2026-08-21T10:00:00.000Z").getTime();
const min = (n: number) => n * 60_000;

describe("elapsedMs", () => {
  it("measures a live, never-paused session up to `now`", () => {
    const s = { startedAt: T0, pausedMs: 0 };
    expect(elapsedMs(s, T0 + min(30))).toBe(min(30));
  });

  it("measures a finished session to its end, ignoring `now`", () => {
    const s = { startedAt: T0, endedAt: T0 + min(45), pausedMs: 0 };
    // Hours later, the answer must not have drifted.
    expect(elapsedMs(s, T0 + min(600))).toBe(min(45));
  });

  it("subtracts completed pauses", () => {
    const s = { startedAt: T0, endedAt: T0 + min(60), pausedMs: min(10) };
    expect(elapsedMs(s, T0 + min(60))).toBe(min(50));
  });

  it("freezes while paused: elapsed does not grow as `now` advances", () => {
    const s = { startedAt: T0, pausedMs: 0, pausedAt: T0 + min(20) };
    const atPause = elapsedMs(s, T0 + min(20));
    const muchLater = elapsedMs(s, T0 + min(200));
    expect(atPause).toBe(min(20));
    expect(muchLater).toBe(min(20));
  });

  it("handles a session finished while still paused", () => {
    // Ran 20m, paused at +20, finished at +50 without resuming.
    const s = {
      startedAt: T0,
      endedAt: T0 + min(50),
      pausedMs: 0,
      pausedAt: T0 + min(20),
    };
    expect(elapsedMs(s, T0 + min(999))).toBe(min(20));
  });

  it("combines completed pauses with an open one", () => {
    // 60m span, 10m already banked as paused, currently paused for 5m more.
    const s = { startedAt: T0, pausedMs: min(10), pausedAt: T0 + min(55) };
    expect(elapsedMs(s, T0 + min(60))).toBe(min(45));
  });

  it("never returns negative time when the clock runs backwards", () => {
    const s = { startedAt: T0, pausedMs: 0 };
    expect(elapsedMs(s, T0 - min(5))).toBe(0);
  });

  it("never returns negative time when pausedMs exceeds the span", () => {
    const s = { startedAt: T0, endedAt: T0 + min(10), pausedMs: min(30) };
    expect(elapsedMs(s, T0 + min(10))).toBe(0);
  });

  it("accepts Date and ISO string inputs equivalently", () => {
    const asNumbers = { startedAt: T0, endedAt: T0 + min(30), pausedMs: 0 };
    const asDates = {
      startedAt: new Date(T0),
      endedAt: new Date(T0 + min(30)),
      pausedMs: 0,
    };
    const asStrings = {
      startedAt: new Date(T0).toISOString(),
      endedAt: new Date(T0 + min(30)).toISOString(),
      pausedMs: 0,
    };
    expect(elapsedMs(asDates)).toBe(elapsedMs(asNumbers));
    expect(elapsedMs(asStrings)).toBe(elapsedMs(asNumbers));
  });

  it("is unaffected by how often it is called (no drift by construction)", () => {
    const s = { startedAt: T0, pausedMs: 0 };
    // Simulates a throttled background tab: sampled twice vs a thousand times.
    const sparse = elapsedMs(s, T0 + min(60));
    let dense = 0;
    for (let i = 0; i <= 1000; i++) dense = elapsedMs(s, T0 + (min(60) * i) / 1000);
    expect(dense).toBe(sparse);
  });
});

describe("spanMs / pausedTotalMs", () => {
  it("span includes paused time, elapsed excludes it", () => {
    const s = { startedAt: T0, endedAt: T0 + min(60), pausedMs: min(15) };
    expect(spanMs(s)).toBe(min(60));
    expect(elapsedMs(s)).toBe(min(45));
    expect(pausedTotalMs(s)).toBe(min(15));
  });

  it("counts an open pause toward the paused total", () => {
    const s = { startedAt: T0, pausedMs: min(5), pausedAt: T0 + min(50) };
    expect(pausedTotalMs(s, T0 + min(60))).toBe(min(15));
  });

  it("span + nothing lost: elapsed + pausedTotal === span", () => {
    const s = { startedAt: T0, pausedMs: min(7), pausedAt: T0 + min(40) };
    const now = T0 + min(60);
    expect(elapsedMs(s, now) + pausedTotalMs(s, now)).toBe(spanMs(s, now));
  });
});

describe("timerState", () => {
  it("classifies running, paused, and ended", () => {
    expect(timerState({ startedAt: T0, pausedMs: 0 })).toBe("running");
    expect(timerState({ startedAt: T0, pausedMs: 0, pausedAt: T0 })).toBe("paused");
    expect(timerState({ startedAt: T0, endedAt: T0, pausedMs: 0 })).toBe("ended");
  });

  it("does not report a finished session as paused", () => {
    const s = { startedAt: T0, endedAt: T0 + min(5), pausedMs: 0, pausedAt: T0 + min(2) };
    expect(isPaused(s)).toBe(false);
  });
});

describe("formatting", () => {
  it("formats HH:MM:SS with uncapped hours", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(min(5) + 3000)).toBe("00:05:03");
    expect(formatDuration(min(60 * 100))).toBe("100:00:00");
  });

  it("floors partial seconds rather than rounding up", () => {
    expect(formatDuration(1999)).toBe("00:00:01");
  });

  it("formats compact totals", () => {
    expect(formatCompact(0)).toBe("0m");
    expect(formatCompact(min(45))).toBe("45m");
    expect(formatCompact(min(120))).toBe("2h");
    expect(formatCompact(min(135))).toBe("2h 15m");
  });
});
