import { describe, expect, it } from "vitest";

import { finishSessionSchema, updateSessionSchema } from "../../schema";
import { MAX_TAG_LENGTH, normalizeTag, normalizeTags } from "../tags";

describe("normalizeTag", () => {
  it("lowercases, trims, drops a leading # and collapses spaces", () => {
    expect(normalizeTag("  #Exam   Prep ")).toBe("exam prep");
    expect(normalizeTag("##lecture")).toBe("lecture");
  });

  it("caps the length", () => {
    expect(normalizeTag("x".repeat(40))).toHaveLength(MAX_TAG_LENGTH);
  });

  it("treats whitespace or a bare # as no tag", () => {
    expect(normalizeTag("   ")).toBe("");
    expect(normalizeTag("#")).toBe("");
  });
});

describe("normalizeTags", () => {
  it("de-duplicates in first-seen order and splits pasted lists", () => {
    expect(normalizeTags(["Lecture", "practice, LECTURE", " ", "#practice"])).toEqual([
      "lecture",
      "practice",
    ]);
  });
});

describe("tag validation in session schemas", () => {
  const id = "00000000-0000-4000-8000-000000000000";

  it("normalises tags on finish and defaults to none", () => {
    expect(finishSessionSchema.parse({ id, tags: ["Exam Prep"] }).tags).toEqual(["exam prep"]);
    expect(finishSessionSchema.parse({ id }).tags).toEqual([]);
  });

  it("refuses more than five tags", () => {
    const tags = ["a", "b", "c", "d", "e", "f"];
    expect(finishSessionSchema.safeParse({ id, tags }).success).toBe(false);
  });

  it("leaves tags untouched on an edit that does not mention them", () => {
    expect(updateSessionSchema.parse({ id }).tags).toBeUndefined();
  });
});
