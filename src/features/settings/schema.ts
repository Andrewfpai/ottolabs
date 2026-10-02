import { z } from "zod";

/**
 * Rejects anything the runtime does not recognise as an IANA zone. The value
 * is fed straight into date bucketing, so a junk string would poison every
 * analytic that depends on it.
 */
export const timezoneSchema = z.string().refine(
  (value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Not a recognised time zone" },
);

/** Night owls get up to noon; past that "the day starts at" stops meaning anything. */
export const DAY_START_HOURS = Array.from({ length: 13 }, (_, h) => h);

export const settingsSchema = z.object({
  timezone: timezoneSchema,
  dayStartHour: z.number().int().min(0).max(12),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  dailyGoalMinutes: z
    .number({ message: "Enter a daily goal in minutes" })
    .int("Use whole minutes")
    .min(15, "Set a daily goal of at least 15 minutes")
    .max(24 * 60, "A day only has 24 hours"),
  pomodoro: z.object({
    workMinutes: z
      .number({ message: "Enter a focus length" })
      .int("Use whole minutes")
      .min(5, "Focus intervals start at 5 minutes")
      .max(120, "Keep focus intervals to 2 hours or less"),
    breakMinutes: z
      .number({ message: "Enter a break length" })
      .int("Use whole minutes")
      .min(1, "A break needs at least a minute")
      .max(60, "Keep short breaks to an hour or less"),
    longBreakMinutes: z
      .number({ message: "Enter a long break length" })
      .int("Use whole minutes")
      .min(1, "A long break needs at least a minute")
      .max(90, "Keep long breaks to 90 minutes or less"),
    cyclesBeforeLongBreak: z
      .number({ message: "Enter how many cycles come before a long break" })
      .int("Use a whole number of cycles")
      .min(1, "At least one cycle before a long break")
      .max(12, "Twelve cycles is the most"),
  }),
});

export type SettingsValues = z.infer<typeof settingsSchema>;
