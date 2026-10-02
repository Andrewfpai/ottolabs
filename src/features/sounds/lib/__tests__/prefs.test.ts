import { describe, expect, it } from "vitest";

import { DEFAULT_SOUND_PREFS, parseSoundPrefs, shouldPlay } from "../prefs";

const running = { endedAt: null, pausedAt: null };

describe("parseSoundPrefs", () => {
  it("falls back to silence for missing or broken data", () => {
    expect(parseSoundPrefs(null)).toEqual(DEFAULT_SOUND_PREFS);
    expect(parseSoundPrefs("{not json")).toEqual(DEFAULT_SOUND_PREFS);
    expect(parseSoundPrefs(JSON.stringify({ sound: "thunder", volume: 0.3 }))).toEqual({ sound: "off", volume: 0.3 });
  });

  it("keeps a known sound and clamps the volume", () => {
    expect(parseSoundPrefs(JSON.stringify({ sound: "rain", volume: 7 }))).toEqual({ sound: "rain", volume: 1 });
  });
});

describe("shouldPlay", () => {
  const rain = { sound: "rain" as const, volume: 0.5 };

  it("plays only while focus time is accruing", () => {
    expect(shouldPlay(running, rain)).toBe(true);
    expect(shouldPlay({ ...running, pausedAt: new Date() }, rain)).toBe(false);
    expect(shouldPlay({ ...running, endedAt: new Date() }, rain)).toBe(false);
    expect(shouldPlay(null, rain)).toBe(false);
  });

  it("stays silent when switched off", () => {
    expect(shouldPlay(running, { sound: "off", volume: 0.5 })).toBe(false);
  });
});
