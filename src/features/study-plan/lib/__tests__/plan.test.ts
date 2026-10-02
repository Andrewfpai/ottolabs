import { describe, expect, it } from "vitest";

import { MAX_UNIT_TITLE, parseUnitTitles, planProgress, pluralUnit, progressLabel } from "../plan";

describe("parseUnitTitles", () => {
  it("takes one unit per line and skips blank lines", () => {
    expect(parseUnitTitles("Intro\n\n  Relational model  \r\nSQL basics\n")).toEqual([
      "Intro",
      "Relational model",
      "SQL basics",
    ]);
  });

  it("strips list markers and our own kind of numbering", () => {
    expect(
      parseUnitTitles(
        ["- Intro", "* Storage", "• Indexes", "1. B-trees", "2) Hashing", "(3) Joins", "12 - Recovery", "Chapter 4: Transactions", "Week 2 – Locks"].join("\n"),
      ),
    ).toEqual(["Intro", "Storage", "Indexes", "B-trees", "Hashing", "Joins", "Recovery", "Transactions", "Locks"]);
  });

  it("keeps numbers that are part of the title", () => {
    expect(parseUnitTitles("3NF and BCNF\nHTTP/2 in practice\n2PC")).toEqual(["3NF and BCNF", "HTTP/2 in practice", "2PC"]);
  });

  it("keeps non-Latin titles and cuts overly long ones", () => {
    expect(parseUnitTitles("第一章 数字逻辑")).toEqual(["第一章 数字逻辑"]);
    expect(parseUnitTitles("x".repeat(300))[0]).toHaveLength(MAX_UNIT_TITLE);
  });
});

describe("planProgress and progressLabel", () => {
  const units = (pattern: string) => [...pattern].map((c) => ({ completedAt: c === "x" ? new Date() : null }));

  it("points at the first unit not yet done", () => {
    const p = planProgress(units("xxxxx_______"));
    expect(p).toEqual({ total: 12, done: 5, nextIndex: 5 });
    expect(progressLabel("Chapter", p)).toBe("Chapter 6 of 12");
  });

  it("does not let skipping ahead claim the units in between", () => {
    const p = planProgress(units("xx__x"));
    expect(p.done).toBe(3);
    expect(progressLabel("Unit", p)).toBe("Unit 3 of 5");
  });

  it("says when the plan is finished, and nothing without one", () => {
    expect(progressLabel("Module", planProgress(units("xxx")))).toBe("All 3 modules done");
    expect(progressLabel("Chapter", planProgress([]))).toBeNull();
  });

  it("pluralises every label", () => {
    expect(pluralUnit("Week")).toBe("weeks");
    expect(pluralUnit("Topic")).toBe("topics");
  });
});
