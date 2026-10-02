import { describe, expect, it } from "vitest";

import { parseFriendHandle, suggestUsername, usernameSchema } from "../username";

describe("usernameSchema", () => {
  it("accepts a leading @ and any case, and stores lowercase", () => {
    expect(usernameSchema.parse(" @Andrew_P ")).toBe("andrew_p");
  });

  it("rejects too short, too long and odd characters", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(21)).success).toBe(false);
    expect(usernameSchema.safeParse("andrew.pai").success).toBe(false);
    expect(usernameSchema.safeParse("andrew pai").success).toBe(false);
  });
});

describe("parseFriendHandle", () => {
  it("tells an email from a username", () => {
    expect(parseFriendHandle("Friend@Gmail.com")).toEqual({ kind: "email", email: "friend@gmail.com" });
    expect(parseFriendHandle("@budi_99")).toEqual({ kind: "username", username: "budi_99" });
    expect(parseFriendHandle("budi_99")).toEqual({ kind: "username", username: "budi_99" });
  });

  it("returns null for something that is neither", () => {
    expect(parseFriendHandle("not an email@")).toBeNull();
    expect(parseFriendHandle("@x")).toBeNull();
    expect(parseFriendHandle("")).toBeNull();
  });
});

describe("suggestUsername", () => {
  it("builds a valid username from the email", () => {
    expect(suggestUsername("Andrew.F.Pai+notes@gmail.com")).toBe("andrew_f_pai");
    expect(suggestUsername("jo@x.com")).toBe("jo_user");
    expect(usernameSchema.safeParse(suggestUsername("a.very.long.name.indeed.yes@x.com")).success).toBe(true);
  });
});
