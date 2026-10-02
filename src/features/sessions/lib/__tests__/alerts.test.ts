import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_POMODORO } from "@/db/schema";

import { claimAlert, parseAlertPrefs, phaseEndMessage, phaseKey } from "../alerts";

/** A minimal in-memory localStorage, shared like the real one is across tabs. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe("phaseEndMessage", () => {
  const config = DEFAULT_POMODORO;

  it("announces the break after a work interval, long or short", () => {
    expect(phaseEndMessage({ ended: "work", nextBreakIsLong: false, config, trackTitle: "Databases" })).toEqual({
      title: "Focus done: Databases",
      body: "Time for a 5-minute break.",
    });
    expect(phaseEndMessage({ ended: "work", nextBreakIsLong: true, config, trackTitle: "Databases" }).body).toBe(
      "Time for a 15-minute long break.",
    );
  });

  it("calls you back to work after either kind of break", () => {
    for (const ended of ["break", "long-break"] as const) {
      expect(phaseEndMessage({ ended, nextBreakIsLong: false, config, trackTitle: "Databases" })).toEqual({
        title: "Break's over",
        body: "Back to Databases for 25 minutes.",
      });
    }
  });
});

describe("parseAlertPrefs", () => {
  it("defaults to sound on, notifications off", () => {
    expect(parseAlertPrefs(null)).toEqual({ sound: true, notify: false });
  });

  it("survives junk and partial values", () => {
    expect(parseAlertPrefs("not json")).toEqual({ sound: true, notify: false });
    expect(parseAlertPrefs('{"notify":true}')).toEqual({ sound: true, notify: true });
    expect(parseAlertPrefs('{"sound":"loud"}')).toEqual({ sound: true, notify: false });
  });
});

describe("claimAlert", () => {
  beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("lets exactly one caller alert per phase, as two tabs would", () => {
    const key = phaseKey("s1", "work", 0);
    expect(claimAlert(key)).toBe(true);
    expect(claimAlert(key)).toBe(false);
  });

  it("treats each phase of each session separately", () => {
    expect(claimAlert(phaseKey("s1", "work", 0))).toBe(true);
    expect(claimAlert(phaseKey("s1", "break", 1))).toBe(true);
    expect(claimAlert(phaseKey("s2", "work", 0))).toBe(true);
  });

  it("forgets claims after a day so storage does not grow forever", () => {
    const old = phaseKey("s1", "work", 0);
    claimAlert(old, 0);
    claimAlert(phaseKey("s9", "work", 0), 25 * 3_600_000);
    expect(localStorage.getItem(`ottolabs:alerted:${old}`)).toBeNull();
  });
});
