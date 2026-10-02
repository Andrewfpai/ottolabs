import { afterEach, describe, expect, it, vi } from "vitest";

import { inviteSchema } from "@/features/access/schema";

import { isOwnerEmail, normalizeEmail, ownerEmails } from "../access";

afterEach(() => vi.unstubAllEnvs());

describe("ownerEmails", () => {
  it("parses a comma-separated list, trimmed and lowercased", () => {
    vi.stubEnv("ALLOWED_EMAILS", " Owner@Gmail.com , second@example.com ,, ");
    expect(ownerEmails()).toEqual(["owner@gmail.com", "second@example.com"]);
  });

  it("is empty when unset, so nobody is an owner by default", () => {
    vi.stubEnv("ALLOWED_EMAILS", "");
    expect(ownerEmails()).toEqual([]);
    expect(isOwnerEmail("anyone@example.com")).toBe(false);
  });
});

describe("isOwnerEmail", () => {
  it("matches regardless of case and surrounding space", () => {
    vi.stubEnv("ALLOWED_EMAILS", "owner@gmail.com");
    expect(isOwnerEmail("  OWNER@gmail.com ")).toBe(true);
    expect(isOwnerEmail("other@gmail.com")).toBe(false);
  });

  it("never treats a missing email as an owner", () => {
    vi.stubEnv("ALLOWED_EMAILS", "owner@gmail.com");
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
  });

  it("does not match on a substring", () => {
    vi.stubEnv("ALLOWED_EMAILS", "owner@gmail.com");
    expect(isOwnerEmail("owner@gmail.com.evil.test")).toBe(false);
    expect(isOwnerEmail("xowner@gmail.com")).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("normalises to lowercase, matching the table's check constraint", () => {
    expect(inviteSchema.parse({ email: "  Friend@Gmail.COM " })).toEqual({
      email: "friend@gmail.com",
    });
    expect(normalizeEmail("  Friend@Gmail.COM ")).toBe("friend@gmail.com");
  });

  it("rejects things that are not email addresses", () => {
    for (const email of ["", "friend", "friend@", "@gmail.com", "a b@gmail.com"]) {
      expect(inviteSchema.safeParse({ email }).success).toBe(false);
    }
  });
});
