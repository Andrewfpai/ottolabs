/**
 * Spaced review of finished tasks: look at it again in 3 days, then 7 days
 * after that, then 21. Each gap roughly doubles or triples, which is the
 * spacing that makes things stick without turning into a chore. Pure, so the
 * schedule is tested.
 *
 * Due dates are calendar days in your zone: a review "due Thursday" is due
 * from the start of Thursday, wherever you are.
 */
import { addDays, type DayKey, zonedInstant } from "@/lib/time/calendar-day";

/** Days until review 1, 2 and 3: counted from finishing, then from each review. */
export const REVIEW_GAPS_DAYS = [3, 7, 21] as const;
export const REVIEW_COUNT = REVIEW_GAPS_DAYS.length;

export type ReviewState = { reviewStage: number; reviewDueAt: Date | null };

/** The first review, three days after today. */
export function firstReview(today: DayKey, timeZone: string): ReviewState {
  return { reviewStage: 1, reviewDueAt: zonedInstant(addDays(today, REVIEW_GAPS_DAYS[0]), null, timeZone) };
}

/** After doing review `stage`: the next one, or done after the last. */
export function afterReview(stage: number, today: DayKey, timeZone: string): ReviewState {
  if (stage < 1 || stage >= REVIEW_COUNT) return { reviewStage: 0, reviewDueAt: null };
  return {
    reviewStage: stage + 1,
    reviewDueAt: zonedInstant(addDays(today, REVIEW_GAPS_DAYS[stage]), null, timeZone),
  };
}

/** Due today or overdue: the due day has started. */
export function isReviewDue(task: ReviewState, now: number): boolean {
  return task.reviewStage > 0 && task.reviewDueAt !== null && task.reviewDueAt.getTime() <= now;
}

/** "Review 2 of 3". */
export function reviewLabel(stage: number): string {
  return `Review ${stage} of ${REVIEW_COUNT}`;
}

/** The evening push: what is up for review today. */
export function reviewsDueMessage(titles: readonly string[]) {
  if (titles.length === 0) return null;
  const shown = titles.slice(0, 3).join(", ");
  const more = titles.length > 3 ? ` and ${titles.length - 3} more` : "";
  return {
    title: titles.length === 1 ? "1 review due today" : `${titles.length} reviews due today`,
    body: `${shown}${more}. A quick look now keeps it from fading.`,
    url: "/tasks",
    tag: "reviews",
  };
}
