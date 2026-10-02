import { describe, expect, it } from "vitest";

import { afterReview, firstReview, isReviewDue, reviewLabel, reviewsDueMessage } from "../reviews";

const TZ = "Asia/Jakarta";

describe("review schedule", () => {
  it("first comes back three days after finishing, at the start of that day", () => {
    const first = firstReview("2026-10-03", TZ);
    expect(first.reviewStage).toBe(1);
    // Midnight 6 October in Jakarta (UTC+7) is 17:00 UTC on the 5th.
    expect(first.reviewDueAt?.toISOString()).toBe("2026-10-05T17:00:00.000Z");
  });

  it("then 7 days after review 1 and 21 days after review 2", () => {
    expect(afterReview(1, "2026-10-06", TZ)).toEqual({
      reviewStage: 2,
      reviewDueAt: new Date("2026-10-12T17:00:00.000Z"),
    });
    expect(afterReview(2, "2026-10-13", TZ).reviewDueAt?.toISOString()).toBe("2026-11-02T17:00:00.000Z");
  });

  it("ends after the third review", () => {
    expect(afterReview(3, "2026-11-03", TZ)).toEqual({ reviewStage: 0, reviewDueAt: null });
  });
});

describe("isReviewDue", () => {
  const due = new Date("2026-10-05T17:00:00.000Z");

  it("is due from the start of the due day, and stays due if missed", () => {
    expect(isReviewDue({ reviewStage: 1, reviewDueAt: due }, due.getTime() - 1)).toBe(false);
    expect(isReviewDue({ reviewStage: 1, reviewDueAt: due }, due.getTime())).toBe(true);
    expect(isReviewDue({ reviewStage: 1, reviewDueAt: due }, due.getTime() + 5 * 86_400_000)).toBe(true);
  });

  it("is never due without a schedule", () => {
    expect(isReviewDue({ reviewStage: 0, reviewDueAt: null }, Date.now())).toBe(false);
  });
});

describe("wording", () => {
  it("labels the stage and summarises the evening push", () => {
    expect(reviewLabel(2)).toBe("Review 2 of 3");
    expect(reviewsDueMessage([])).toBeNull();
    expect(reviewsDueMessage(["Homework 1"])?.title).toBe("1 review due today");
    expect(reviewsDueMessage(["A", "B", "C", "D", "E"])?.body).toContain("A, B, C and 2 more");
  });
});
