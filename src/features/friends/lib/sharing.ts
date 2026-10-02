/**
 * What a friend is allowed to see, as pure functions so the rules are tested
 * rather than trusted.
 */

/**
 * Track titles can be personal ("Job applications", "Therapy homework"), so
 * unless their owner opted in, friends see "Track 1, Track 2…" — numbered by
 * the owner's own track order, so the numbering is stable from visit to visit.
 * Colours are kept: they say nothing on their own.
 */
export function redactTrackTitles<T extends { title: string }>(
  tracks: readonly T[],
  shareNames: boolean,
): T[] {
  if (shareNames) return [...tracks];
  return tracks.map((track, i) => ({ ...track, title: `Track ${i + 1}` }));
}

/** The name to show for a person: their Google name, else their email's local part. */
export function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email.split("@")[0];
}

export type Standing = {
  id: string;
  name: string;
  isSelf: boolean;
  weekMs: number;
};

/**
 * The weekly list: most focus first, ties broken by name so the order does
 * not shuffle between reloads. No ranks or medals — just who has put in the
 * hours this week.
 */
export function weeklyStandings<T extends Standing>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.weekMs - a.weekMs || a.name.localeCompare(b.name));
}
