/**
 * Shared `layoutId`s for the timer morph.
 *
 * The mini bar and the fullscreen focus timer are two components that render
 * in different places in the tree, and Motion matches them by these strings.
 * Passing the same literal in both places is what makes the digits fly from
 * the corner of the screen into the middle of it, rather than one element
 * disappearing and an unrelated one fading in.
 *
 * They live here rather than in either component so that neither owns them,
 * and a rename cannot silently break the pairing on one side only.
 */
export const TIMER_LAYOUT_ID = {
  badge: "timer-track-badge",
  readout: "timer-readout",
} as const;
