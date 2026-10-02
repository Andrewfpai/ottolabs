import { describe, expect, it } from "vitest";

import { parseRoomCode, roomInvitePath } from "../invite-code";

const CODE = "aB3_x-Z9qK0p";

describe("parseRoomCode", () => {
  it("reads the code out of a pasted link", () => {
    expect(parseRoomCode(`https://ottolabs.app${roomInvitePath(CODE)}`)).toBe(CODE);
    expect(parseRoomCode(`  https://ottolabs.app/rooms/join/${CODE}/  `)).toBe(CODE);
    expect(parseRoomCode(`https://ottolabs.app/rooms/join/${CODE}?from=chat`)).toBe(CODE);
  });

  it("accepts the bare code", () => {
    expect(parseRoomCode(CODE)).toBe(CODE);
  });

  it("rejects anything else", () => {
    expect(parseRoomCode("")).toBeNull();
    expect(parseRoomCode("https://ottolabs.app/rooms/123")).toBeNull();
    expect(parseRoomCode("short")).toBeNull();
  });
});
