/**
 * Session tags: short labels for what kind of work a session was —
 * "lecture", "practice", "exam prep". Free text, kept tidy so that "Exam
 * Prep", "#exam-prep " and "exam prep" do not become three different tags.
 */
export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 24;

/** Lowercase, no leading #, single spaces, trimmed. Empty means "not a tag". */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, MAX_TAG_LENGTH)
    .trim();
}

/** Normalised, de-duplicated in first-seen order, empties dropped. */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const value of raw) {
    // A pasted "lecture, practice" is two tags, not one.
    for (const part of value.split(",")) {
      const tag = normalizeTag(part);
      if (tag) seen.add(tag);
    }
  }
  return [...seen];
}
