import { describe, expect, it } from "vitest";

import { expiresIn, inviteStatus, looksLikeInviteToken } from "../invite-links";

const now = Date.UTC(2026, 9, 3, 12);

describe("inviteStatus", () => {
  it("is waiting until used or past its expiry", () => {
    expect(inviteStatus({ usedAt: null, expiresAt: new Date(now + 1000) }, now)).toBe("waiting");
    expect(inviteStatus({ usedAt: null, expiresAt: new Date(now) }, now)).toBe("expired");
    expect(inviteStatus({ usedAt: new Date(now - 1000), expiresAt: new Date(now - 5000) }, now)).toBe("used");
  });
});

describe("looksLikeInviteToken", () => {
  it("accepts only 32 base64url characters", () => {
    expect(looksLikeInviteToken("A".repeat(32))).toBe(true);
    expect(looksLikeInviteToken("abc_-DEF123".padEnd(32, "x"))).toBe(true);
    expect(looksLikeInviteToken("A".repeat(31))).toBe(false);
    expect(looksLikeInviteToken("A".repeat(31) + "/")).toBe(false);
  });
});

describe("expiresIn", () => {
  it("reads in hours, then days", () => {
    expect(expiresIn(new Date(now + 23 * 3_600_000), now)).toBe("in 23 hours");
    expect(expiresIn(new Date(now + 6 * 86_400_000), now)).toBe("in 6 days");
    expect(expiresIn(new Date(now + 10 * 60_000), now)).toBe("within the hour");
  });
});
