import { describe, expect, it } from "vitest";

import type { PomodoroConfig } from "@/db/schema";

import {
  breakIsLong,
  formatCountdown,
  isOnBreak,
  phaseLabel,
  pomodoroPhase,
  sanitizeConfig,
  type PomodoroSnapshot,
} from "../pomodoro";

const T0 = new Date("2026-08-21T20:00:00.000Z").getTime();
const min = (n: number) => n * 60_000;

const CONFIG: PomodoroConfig = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

function session(overrides: Partial<PomodoroSnapshot> = {}): PomodoroSnapshot {
  return {
    startedAt: T0,
    pausedMs: 0,
    mode: "pomodoro",
    completedCycles: 0,
    breakMs: 0,
    pomodoroConfig: CONFIG,
    ...overrides,
  };
}

describe("pomodoroPhase — work intervals", () => {
  it("counts down the first interval from focus time", () => {
    const phase = pomodoroPhase(session(), T0 + min(10));

    expect(phase.kind).toBe("work");
    expect(phase.cycle).toBe(1);
    expect(phase.remainingMs).toBe(min(15));
    expect(phase.isOver).toBe(false);
  });

  it("does not advance while the session is paused", () => {
    // Paused at +10 and left there: the interval has 15m left, forever.
    const s = session({ pausedAt: T0 + min(10) });

    expect(pomodoroPhase(s, T0 + min(10)).remainingMs).toBe(min(15));
    expect(pomodoroPhase(s, T0 + min(90)).remainingMs).toBe(min(15));
  });

  it("excludes banked pause time from the interval", () => {
    // 40m of wall clock, 20m of it paused → only 20m of focus has accrued.
    const s = session({ pausedMs: min(20) });
    expect(pomodoroPhase(s, T0 + min(40)).remainingMs).toBe(min(5));
  });

  it("measures the second interval from the end of the first", () => {
    // One interval done; focus time is 25m of work + 30m more.
    const s = session({ completedCycles: 1, pausedMs: min(5) });
    const phase = pomodoroPhase(s, T0 + min(35));

    expect(phase.cycle).toBe(2);
    // 30m of focus, 25m of which belonged to interval 1.
    expect(phase.elapsedMs).toBe(min(5));
    expect(phase.remainingMs).toBe(min(20));
  });

  it("reports overrun rather than resetting when a tab was hidden", () => {
    // The tab was buried; nobody was there to start the break at 25m.
    const phase = pomodoroPhase(session(), T0 + min(40));

    expect(phase.isOver).toBe(true);
    expect(phase.remainingMs).toBe(min(-15));
    // Overrun time is still focus time — the progress ring simply pins full.
    expect(phase.progress).toBe(1);
    expect(phase.elapsedMs).toBe(min(40));
  });

  it("flags when the next break will be a long one", () => {
    const s = session({ completedCycles: 3, pausedMs: 0 });
    expect(pomodoroPhase(s, T0 + min(80)).nextBreakIsLong).toBe(true);

    const earlier = session({ completedCycles: 1 });
    expect(pomodoroPhase(earlier, T0 + min(30)).nextBreakIsLong).toBe(false);
  });
});

describe("pomodoroPhase — breaks", () => {
  it("counts a short break down from breakStartedAt in wall-clock time", () => {
    const s = session({
      completedCycles: 1,
      pausedAt: T0 + min(25),
      breakStartedAt: T0 + min(25),
    });
    const phase = pomodoroPhase(s, T0 + min(27));

    expect(phase.kind).toBe("break");
    expect(phase.durationMs).toBe(min(5));
    expect(phase.remainingMs).toBe(min(3));
  });

  it("gives a long break after the configured number of intervals", () => {
    const s = session({
      completedCycles: 4,
      pausedAt: T0 + min(100),
      breakStartedAt: T0 + min(100),
    });
    const phase = pomodoroPhase(s, T0 + min(105));

    expect(phase.kind).toBe("long-break");
    expect(phase.durationMs).toBe(min(15));
    expect(phase.remainingMs).toBe(min(10));
  });

  it("attributes the break to the interval that just finished", () => {
    const s = session({
      completedCycles: 2,
      pausedAt: T0 + min(55),
      breakStartedAt: T0 + min(55),
    });
    expect(pomodoroPhase(s, T0 + min(56)).cycle).toBe(2);
  });

  it("reports a break that ran over instead of rolling into the next one", () => {
    const s = session({
      completedCycles: 1,
      pausedAt: T0 + min(25),
      breakStartedAt: T0 + min(25),
    });
    const phase = pomodoroPhase(s, T0 + min(45));

    expect(phase.kind).toBe("break");
    expect(phase.isOver).toBe(true);
    expect(phase.remainingMs).toBe(min(-15));
  });

  it("treats a finished session as no longer on a break", () => {
    // Finishing banks the open break and clears the flag, so this shape does
    // not occur in the database — but nothing downstream should ever show a
    // live countdown for a session that is over.
    const s = session({ endedAt: T0 + min(30), breakStartedAt: T0 + min(25) });
    expect(isOnBreak(s)).toBe(false);
  });

  it("freezes the phase of a finished session at its final focus time", () => {
    const s = session({ completedCycles: 1, endedAt: T0 + min(28), pausedMs: min(3) });
    // Hours later, the last interval still reads the same.
    expect(pomodoroPhase(s, T0 + min(600)).elapsedMs).toBe(0);
    expect(pomodoroPhase(s, T0 + min(600)).cycle).toBe(2);
  });

  it("does not treat a plain pause as a break", () => {
    const s = session({ pausedAt: T0 + min(10) });
    expect(isOnBreak(s)).toBe(false);
    expect(pomodoroPhase(s, T0 + min(12)).kind).toBe("work");
  });
});

describe("breakIsLong", () => {
  it("is false before any interval is complete", () => {
    expect(breakIsLong(0, CONFIG)).toBe(false);
  });

  it("lands on every fourth interval with the default config", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => breakIsLong(n, CONFIG))).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
    ]);
  });
});

describe("sanitizeConfig", () => {
  it("falls back to the defaults when nothing is stored", () => {
    expect(sanitizeConfig(null)).toEqual({
      workMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
    });
  });

  it("replaces a zero-length work interval, which would divide by nothing", () => {
    const cleaned = sanitizeConfig({ ...CONFIG, workMinutes: 0 });
    expect(cleaned.workMinutes).toBe(25);
  });

  it("keeps the long-break cadence at one interval or more", () => {
    expect(sanitizeConfig({ ...CONFIG, cyclesBeforeLongBreak: 0 }).cyclesBeforeLongBreak).toBe(1);
  });

  it("survives a session whose stored config is missing entirely", () => {
    const phase = pomodoroPhase(
      session({ pomodoroConfig: null }),
      T0 + min(10),
    );
    expect(phase.remainingMs).toBe(min(15));
  });
});

describe("formatCountdown", () => {
  it("renders minutes and seconds", () => {
    expect(formatCountdown(min(24) + 3_000)).toBe("24:03");
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("rolls hours into minutes rather than adding a field", () => {
    expect(formatCountdown(min(90))).toBe("90:00");
  });

  it("signs an overrun", () => {
    expect(formatCountdown(-min(2))).toBe("-2:00");
  });
});

describe("phaseLabel", () => {
  it("names the interval it is in", () => {
    expect(phaseLabel(pomodoroPhase(session(), T0 + min(1)))).toBe("Focus 1");
  });

  it("distinguishes the long break", () => {
    const s = session({
      completedCycles: 4,
      pausedAt: T0 + min(100),
      breakStartedAt: T0 + min(100),
    });
    expect(phaseLabel(pomodoroPhase(s, T0 + min(101)))).toBe("Long break");
  });
});
