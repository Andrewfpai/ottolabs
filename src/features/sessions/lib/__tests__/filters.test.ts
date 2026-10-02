import { describe, expect, it } from "vitest";

import { containsPattern, hasFilters, parseSessionFilters, sessionsHref } from "../filters";

const TRACK = "00000000-0000-4000-8000-000000000000";

describe("parseSessionFilters", () => {
  it("keeps valid filters and normalises the tag", () => {
    expect(
      parseSessionFilters({ track: TRACK, tag: " #Exam Prep", from: "2026-09-01", to: "2026-09-30", q: " b-tree " }),
    ).toEqual({ track: TRACK, tag: "exam prep", from: "2026-09-01", to: "2026-09-30", q: "b-tree" });
  });

  it("drops anything malformed rather than querying it", () => {
    expect(parseSessionFilters({ track: "1; drop table", from: "2026-02-30", to: "yesterday", tag: "  " })).toEqual({});
  });

  it("swaps a backwards date range", () => {
    expect(parseSessionFilters({ from: "2026-10-01", to: "2026-09-01" })).toMatchObject({
      from: "2026-09-01",
      to: "2026-10-01",
    });
  });

  it("takes the first of repeated params and caps the search length", () => {
    const parsed = parseSessionFilters({ q: ["x".repeat(500), "ignored"] });
    expect(parsed.q).toHaveLength(100);
  });
});

describe("sessionsHref", () => {
  it("round-trips filters and pages, omitting page 1", () => {
    const filters = { tag: "exam prep", q: "a&b" };
    expect(sessionsHref(filters)).toBe("/sessions?tag=exam+prep&q=a%26b");
    expect(sessionsHref(filters, 3)).toBe("/sessions?tag=exam+prep&q=a%26b&page=3");
    expect(sessionsHref({})).toBe("/sessions");
  });

  it("reports whether anything is filtered", () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ q: "x" })).toBe(true);
  });
});

describe("containsPattern", () => {
  it("searches for wildcard characters literally", () => {
    expect(containsPattern("100%")).toBe("%100\\%%");
    expect(containsPattern("snake_case")).toBe("%snake\\_case%");
    expect(containsPattern("a\\b")).toBe("%a\\\\b%");
  });
});
