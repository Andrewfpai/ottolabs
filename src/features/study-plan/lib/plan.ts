/**
 * Study plan rules, pure so they are tested: what a pasted list turns into,
 * and how progress reads.
 */
export const UNIT_LABELS = ["Chapter", "Unit", "Module", "Lesson", "Week", "Topic"] as const;
export type UnitLabel = (typeof UNIT_LABELS)[number];

export const MAX_UNITS = 200;
export const MAX_UNIT_TITLE = 120;

/** "Chapter" → "chapters". All the labels pluralise with an s. */
export function pluralUnit(label: string): string {
  return `${label.toLowerCase()}s`;
}

// "- ", "* ", "• ", "1. ", "1) ", "(1) ", "12 - " at the start of a line.
const LIST_MARKER = /^\s*(?:[-*•–]\s+|\(?\d{1,3}[.)]\s+|\d{1,3}\s*[-–:]\s+)/;
// "Chapter 3: ", "Unit 2 – ", "Week 4. " — the numbering we add ourselves.
const LABEL_PREFIX = /^(?:chapter|unit|module|lesson|week|topic|part|section)\s+\d{1,3}\s*[:.\-–]\s*/i;

/**
 * A pasted table of contents, one unit per line. List markers and "Chapter
 * 3:" prefixes are stripped, since the plan numbers units itself; blank
 * lines are skipped; overly long titles are cut.
 */
export function parseUnitTitles(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(LIST_MARKER, "").replace(LABEL_PREFIX, "").trim())
    .filter(Boolean)
    .map((title) => title.slice(0, MAX_UNIT_TITLE).trim());
}

export type PlanProgress = {
  total: number;
  done: number;
  /** 0-based index of the first unit not yet done; null when all are done. */
  nextIndex: number | null;
};

/** Units in plan order. */
export function planProgress(units: readonly { completedAt: Date | null }[]): PlanProgress {
  const nextIndex = units.findIndex((u) => !u.completedAt);
  return {
    total: units.length,
    done: units.filter((u) => u.completedAt).length,
    nextIndex: nextIndex === -1 ? null : nextIndex,
  };
}

/**
 * "Chapter 6 of 12" — where you are, by the first unit not yet done (so
 * skipping ahead and ticking off Chapter 9 does not claim Chapters 6–8).
 * "All 12 chapters done" at the end; null without a plan.
 */
export function progressLabel(label: string, progress: PlanProgress): string | null {
  if (progress.total === 0) return null;
  if (progress.nextIndex === null) return `All ${progress.total} ${pluralUnit(label)} done`;
  return `${label} ${progress.nextIndex + 1} of ${progress.total}`;
}
