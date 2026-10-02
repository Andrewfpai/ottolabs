import { describe, expect, it } from "vitest";

import { buildInsights } from "@/features/analytics/lib/insights";

import { displayName, redactTrackTitles, weeklyStandings } from "../sharing";

describe("redactTrackTitles", () => {
  const tracks = [
    { id: "a", title: "Job applications", color: "teal" },
    { id: "b", title: "Japanese", color: "rose" },
  ];

  it("hides titles by default, numbering by the owner's order and keeping colours", () => {
    expect(redactTrackTitles(tracks, false)).toEqual([
      { id: "a", title: "Track 1", color: "teal" },
      { id: "b", title: "Track 2", color: "rose" },
    ]);
  });

  it("shows real titles when their owner opted in", () => {
    expect(redactTrackTitles(tracks, true)).toEqual(tracks);
  });

  it("does not mutate the input", () => {
    redactTrackTitles(tracks, false);
    expect(tracks[0].title).toBe("Job applications");
  });
});

describe("displayName", () => {
  it("prefers the Google name and falls back to the email's local part", () => {
    expect(displayName({ name: "Andrew", email: "a@x.com" })).toBe("Andrew");
    expect(displayName({ name: null, email: "study.buddy@gmail.com" })).toBe("study.buddy");
    expect(displayName({ name: "  ", email: "sam@x.com" })).toBe("sam");
  });
});

describe("weeklyStandings", () => {
  it("orders by focus this week, then by name, without mutating", () => {
    const rows = [
      { id: "1", name: "Bea", isSelf: false, weekMs: 100 },
      { id: "2", name: "Al", isSelf: true, weekMs: 300 },
      { id: "3", name: "Ana", isSelf: false, weekMs: 100 },
    ];
    expect(weeklyStandings(rows).map((r) => r.name)).toEqual(["Al", "Ana", "Bea"]);
    expect(rows[0].name).toBe("Bea");
  });
});

describe("insights about a friend", () => {
  it("speak about them, not about you", () => {
    const text = buildInsights({
      kpis: { totalMs: 1, sessionCount: 10, averageSessionMs: 1, activeDays: 4, days: 7, bestDay: null },
      profile: Array.from({ length: 24 }, (_, h) => (h === 21 ? 300 : h === 9 ? 100 : 0)),
      peak: { startHour: 21, endHour: 23, ms: 300, share: 0.75 },
      weekdayAverages: [],
      medianSessionMs: 48 * 60_000,
      topTracks: [
        { title: "Track 1", share: 0.6 },
        { title: "Track 2", share: 0.4 },
      ],
      streaks: { current: 3, longest: 3 },
      perspective: "friend",
    }).map((i) => i.text);

    expect(text).toEqual([
      "Their peak focus window is 21:00–23:00, with 75% of their focus.",
      "They focus 3.0× more in the evening than in the morning.",
      "Their typical session runs 48m.",
      "They focused on 4 of the last 7 days.",
      "Track 1 took 60% of their focus.",
      "They are on a 3-day streak, their longest yet.",
    ]);
  });
});
