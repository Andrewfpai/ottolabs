/**
 * The categorical palette a Track can be assigned.
 *
 * Tracks store the *name* ("teal"), never a hex value. That keeps every colour
 * decision in `globals.css`, so the palette can be retuned — or made to differ
 * between light and dark, which it does — without a data migration.
 *
 * Tailwind cannot see dynamically built class names, so the classes are spelled
 * out here in full rather than assembled as `bg-track-${name}`.
 */
/**
 * The order is part of the palette, not a list: it is the order new tracks are
 * offered colours in, and it was chosen (with the values in globals.css) so
 * that neighbours stay distinct for colour-blind readers. Change both together
 * and re-run the palette checker.
 */
export const TRACK_COLORS = [
  "teal",
  "rose",
  "violet",
  "amber",
  "sky",
  "emerald",
  "fuchsia",
  "lime",
] as const;

export type TrackColor = (typeof TRACK_COLORS)[number];

export const DEFAULT_TRACK_COLOR: TrackColor = "teal";

type ColorClasses = {
  /** Solid fill — dots, progress rings, chart series. */
  bg: string;
  /** Foreground text in the track's colour. */
  text: string;
  /** Subtle tinted surface for cards and badges. */
  surface: string;
  border: string;
  /** CSS custom property, for inline styles and chart libraries. */
  cssVar: string;
};

export const TRACK_COLOR_CLASSES: Record<TrackColor, ColorClasses> = {
  teal: {
    bg: "bg-track-teal",
    text: "text-track-teal",
    surface: "bg-track-teal/10",
    border: "border-track-teal/30",
    cssVar: "var(--track-teal)",
  },
  amber: {
    bg: "bg-track-amber",
    text: "text-track-amber",
    surface: "bg-track-amber/10",
    border: "border-track-amber/30",
    cssVar: "var(--track-amber)",
  },
  sky: {
    bg: "bg-track-sky",
    text: "text-track-sky",
    surface: "bg-track-sky/10",
    border: "border-track-sky/30",
    cssVar: "var(--track-sky)",
  },
  violet: {
    bg: "bg-track-violet",
    text: "text-track-violet",
    surface: "bg-track-violet/10",
    border: "border-track-violet/30",
    cssVar: "var(--track-violet)",
  },
  rose: {
    bg: "bg-track-rose",
    text: "text-track-rose",
    surface: "bg-track-rose/10",
    border: "border-track-rose/30",
    cssVar: "var(--track-rose)",
  },
  emerald: {
    bg: "bg-track-emerald",
    text: "text-track-emerald",
    surface: "bg-track-emerald/10",
    border: "border-track-emerald/30",
    cssVar: "var(--track-emerald)",
  },
  lime: {
    bg: "bg-track-lime",
    text: "text-track-lime",
    surface: "bg-track-lime/10",
    border: "border-track-lime/30",
    cssVar: "var(--track-lime)",
  },
  fuchsia: {
    bg: "bg-track-fuchsia",
    text: "text-track-fuchsia",
    surface: "bg-track-fuchsia/10",
    border: "border-track-fuchsia/30",
    cssVar: "var(--track-fuchsia)",
  },
};

export function isTrackColor(value: string): value is TrackColor {
  return (TRACK_COLORS as readonly string[]).includes(value);
}

export function trackColorClasses(value: string): ColorClasses {
  return TRACK_COLOR_CLASSES[isTrackColor(value) ? value : DEFAULT_TRACK_COLOR];
}

/**
 * Pick the least-used colour so a new track is visually distinct from the
 * existing ones, rather than the third teal on the page.
 */
export function suggestTrackColor(taken: readonly string[]): TrackColor {
  const counts = new Map<TrackColor, number>(TRACK_COLORS.map((c) => [c, 0]));
  for (const color of taken) {
    if (isTrackColor(color)) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  let best: TrackColor = TRACK_COLORS[0];
  let bestCount = Number.POSITIVE_INFINITY;
  for (const color of TRACK_COLORS) {
    const count = counts.get(color) ?? 0;
    if (count < bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}
