/**
 * The Sessions page filters, carried in the URL so a refresh or a shared
 * link keeps them. Anything malformed is dropped rather than queried.
 */
import { z } from "zod";

import { normalizeTag } from "@/features/sessions/lib/tags";
import { type DayKey, isDayKey } from "@/lib/time/calendar-day";

export type SessionFilters = {
  track?: string;
  tag?: string;
  /** Calendar days in the user's zone, inclusive. */
  from?: DayKey;
  to?: DayKey;
  /** Searched in session notes. */
  q?: string;
};

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const MAX_QUERY_LENGTH = 100;

export function parseSessionFilters(params: Params): SessionFilters {
  const filters: SessionFilters = {};

  const track = first(params.track);
  if (track && z.uuid().safeParse(track).success) filters.track = track;

  const tag = normalizeTag(first(params.tag) ?? "");
  if (tag) filters.tag = tag;

  let from = first(params.from);
  let to = first(params.to);
  if (from && !isDayKey(from)) from = undefined;
  if (to && !isDayKey(to)) to = undefined;
  // A backwards range is almost certainly the two dates swapped.
  if (from && to && from > to) [from, to] = [to, from];
  if (from) filters.from = from;
  if (to) filters.to = to;

  const q = first(params.q)?.trim().slice(0, MAX_QUERY_LENGTH);
  if (q) filters.q = q;

  return filters;
}

export function hasFilters(filters: SessionFilters): boolean {
  return Object.values(filters).some(Boolean);
}

/** The page URL for these filters; page 1 is left out. */
export function sessionsHref(filters: SessionFilters, page = 1): string {
  const params = new URLSearchParams();
  for (const key of ["track", "tag", "from", "to", "q"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/sessions?${query}` : "/sessions";
}

/**
 * A LIKE pattern that matches `q` literally anywhere: `%`, `_` and `\` typed
 * by the user are searched for, not treated as wildcards.
 */
export function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
