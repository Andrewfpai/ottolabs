import { z } from "zod";

export const startSessionSchema = z.object({
  trackId: z.uuid(),
  mode: z.enum(["stopwatch", "pomodoro"]).default("stopwatch"),
});

export const sessionIdSchema = z.object({ id: z.uuid() });

export const finishSessionSchema = z.object({
  id: z.uuid(),
  note: z
    .string()
    .trim()
    .max(2000, "Keep the note under 2000 characters")
    .optional()
    .transform((value) => (value ? value : null)),
});

/**
 * How long the tab was hidden, reported by the idle-return prompt.
 *
 * Bounded rather than trusted: this number comes from a browser that may have
 * been suspended, and the server clamps it against the session's real span
 * anyway (see `bankIdleTime`).
 */
export const trimIdleSchema = z.object({
  id: z.uuid(),
  awayMs: z.number().int().positive().max(24 * 3_600_000),
});

const MAX_SESSION_HOURS = 24;

/**
 * Manual entry, for time you focused but forgot to press Start on.
 *
 * Without this, the first time you forget to start the timer the log is
 * already wrong, and a log you do not trust is a log you stop using.
 */
export const manualSessionSchema = z
  .object({
    trackId: z.uuid(),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date(),
    note: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .refine((v) => v.endedAt > v.startedAt, {
    message: "The end time has to be after the start time",
    path: ["endedAt"],
  })
  .refine((v) => v.startedAt.getTime() <= Date.now() + 60_000, {
    message: "That start time is in the future",
    path: ["startedAt"],
  })
  .refine((v) => v.endedAt.getTime() <= Date.now() + 60_000, {
    message: "That end time is in the future",
    path: ["endedAt"],
  })
  .refine(
    (v) =>
      v.endedAt.getTime() - v.startedAt.getTime() <= MAX_SESSION_HOURS * 3_600_000,
    {
      message: `A single session cannot be longer than ${MAX_SESSION_HOURS} hours`,
      path: ["endedAt"],
    },
  );

export const updateSessionSchema = z
  .object({
    id: z.uuid(),
    trackId: z.uuid().optional(),
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().optional(),
    note: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((value) => (value === undefined ? undefined : value || null)),
  })
  .refine(
    (v) => !v.startedAt || !v.endedAt || v.endedAt > v.startedAt,
    { message: "The end time has to be after the start time", path: ["endedAt"] },
  );

export type ManualSessionValues = z.input<typeof manualSessionSchema>;
