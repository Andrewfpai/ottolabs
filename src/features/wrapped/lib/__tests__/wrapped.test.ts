import { describe, expect, it } from "vitest";

import { changeVsLastMonth, hourLabel, introLine, peakHour, persona, pick, totalLine } from "../wrapped";

const H = 3_600_000;
const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];

describe("pick", () => {
  it("is the same for the same month, so a Wrapped always reads the same", () => {
    expect(pick("2026-09", "intro", ["a", "b", "c"])).toBe(pick("2026-09", "intro", ["a", "b", "c"]));
  });

  it("varies from month to month", () => {
    const seen = new Set(MONTHS.map((m) => introLine(m)));
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe("totalLine", () => {
  it("varies across months, and never says zero of anything", () => {
    const lines = MONTHS.map((m) => totalLine(m, 42 * H));
    expect(new Set(lines).size).toBeGreaterThan(2);
    for (const line of lines) expect(line).not.toMatch(/That's 0 /);
  });

  it("only offers comparisons a small month can fill", () => {
    // 50 minutes: only the 45-minute episode fits.
    expect(totalLine("2026-09", 50 * 60_000)).toMatch(/1 episodes|episodes/);
    expect(totalLine("2026-09", 10 * 60_000)).toMatch(/start/);
  });
});

describe("the rest", () => {
  it("compares with last month only when there was one", () => {
    expect(changeVsLastMonth(42 * H, 35 * H)).toBe("+20% vs last month");
    expect(changeVsLastMonth(30 * H, 40 * H)).toBe("−25% vs last month");
    expect(changeVsLastMonth(10 * H, null)).toBeNull();
  });

  it("finds the peak hour and labels it", () => {
    const hours = Array.from({ length: 24 }, (_, h) => (h === 21 ? 4 * H : H));
    expect(peakHour(hours)).toBe(21);
    expect(hourLabel(21)).toBe("9 PM");
    expect(hourLabel(0)).toBe("12 AM");
    expect(peakHour(Array(24).fill(0))).toBeNull();
  });

  it("names a persona from when and how you study", () => {
    const hours = Array.from({ length: 24 }, (_, h) => (h === 22 ? 5 * H : 0));
    const p = persona({ month: "2026-09", hours, focusMs: 40 * H, sessions: 80, activeDays: 25, daysInMonth: 30 });
    expect(p.title).toBe("The Night Owl Scholar");
    expect(p.line.length).toBeGreaterThan(10);
  });
});
