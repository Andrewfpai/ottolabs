import { z } from "zod";

import { TRACK_COLORS } from "@/lib/track-colors";

/** lucide-react icon names offered in the track form. */
export const TRACK_ICONS = [
  "book-open",
  "database",
  "shield",
  "network",
  "binary",
  "languages",
  "code",
  "terminal",
  "cpu",
  "brain",
  "flask-conical",
  "palette",
  "music",
  "dumbbell",
  "calculator",
  "globe",
] as const;

export type TrackIcon = (typeof TRACK_ICONS)[number];

export const trackFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the track a name")
    .max(60, "Keep it under 60 characters"),
  description: z
    .string()
    .trim()
    .max(280, "Keep it under 280 characters")
    // nullish, not optional: the schema's own output turns "" into null, and
    // that output must parse again on the server.
    .nullish()
    .transform((value) => (value ? value : null)),
  color: z.enum(TRACK_COLORS),
  icon: z.enum(TRACK_ICONS),
  targetMinutesPerWeek: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 7, "That is more than a week")
    .nullable(),
});

export type TrackFormValues = z.infer<typeof trackFormSchema>;

export const createTrackSchema = trackFormSchema;
export const updateTrackSchema = trackFormSchema.extend({
  id: z.uuid(),
});

export const trackIdSchema = z.object({ id: z.uuid() });
