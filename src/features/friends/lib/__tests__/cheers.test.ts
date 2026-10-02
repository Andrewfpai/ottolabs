import { describe, expect, it } from "vitest";

import { CHEER_COOLDOWN_MS, cheerMessage, cheerWaitMs, describeWait } from "../cheers";

describe("cheer cooldown", () => {
  const now = Date.UTC(2026, 9, 3, 12);

  it("allows a first cheer and one after the cooldown", () => {
    expect(cheerWaitMs(null, now)).toBe(0);
    expect(cheerWaitMs(new Date(now - CHEER_COOLDOWN_MS), now)).toBe(0);
  });

  it("reports the time left inside the cooldown", () => {
    expect(cheerWaitMs(new Date(now - 3_600_000), now)).toBe(2 * 3_600_000);
    expect(describeWait(2 * 3_600_000)).toBe("about 2 hours");
    expect(describeWait(40 * 60_000)).toBe("40 minutes");
    expect(describeWait(90_000)).toBe("a few minutes");
  });
});

describe("cheerMessage", () => {
  it("names the sender and the recipient's day", () => {
    const message = cheerMessage({ fromId: "u1", name: "Budi", kind: "fire", todayMs: 3 * 3_600_000 });
    expect(message.title).toBe("🔥 Budi cheered you on");
    expect(message.body).toContain("3h");
    expect(message.tag).toBe("cheer-u1");
  });

  it("nudges gently when nothing is logged yet", () => {
    expect(cheerMessage({ fromId: "u1", name: "Budi", kind: "clap", todayMs: 0 }).body).toMatch(/start/);
  });
});
