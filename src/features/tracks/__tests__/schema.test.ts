import { describe, expect, it } from "vitest";

import { createTrackSchema, updateTrackSchema } from "../schema";

const base = { title: "数字设计与计算", color: "sky", icon: "book-open", targetMinutesPerWeek: null };

describe("track schema", () => {
  it("accepts an empty description and stores it as null", () => {
    expect(createTrackSchema.parse({ ...base, description: "" }).description).toBeNull();
  });

  it("accepts its own output again — the bug behind 'expected string, received null'", () => {
    const once = createTrackSchema.parse({ ...base, description: "" });
    expect(createTrackSchema.safeParse(once).success).toBe(true);
    expect(
      updateTrackSchema.safeParse({ ...once, id: "00000000-0000-4000-8000-000000000000" }).success,
    ).toBe(true);
  });

  it("keeps non-Latin titles intact", () => {
    expect(createTrackSchema.parse({ ...base, description: "x" }).title).toBe("数字设计与计算");
  });
});
