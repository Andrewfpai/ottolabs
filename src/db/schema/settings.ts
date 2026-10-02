/**
 * Per-user preferences. One row per user, created on first sign-in.
 *
 * `dayStartHour` is the night-owl boundary: with the default of 4, work done
 * at 01:00 counts toward the previous day. Every date bucket in analytics and
 * every streak calculation respects it — otherwise a 1am study session looks
 * like it broke your streak *and* started a new one.
 */
import { relations } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { users } from "./auth";
import type { PomodoroConfig } from "./sessions";

export const DEFAULT_POMODORO: PomodoroConfig = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  /** IANA zone, seeded from the browser on first sign-in. */
  timezone: text("timezone").notNull().default("UTC"),

  /** 0-23. Hour at which a new "day" begins for bucketing and streaks. */
  dayStartHour: integer("day_start_hour").notNull().default(4),

  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(120),
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: integer("week_starts_on").notNull().default(1),

  defaultPomodoro: jsonb("default_pomodoro")
    .$type<PomodoroConfig>()
    .notNull()
    .default(DEFAULT_POMODORO),

  theme: text("theme").notNull().default("system"),

  // What friends may see. Both default to private: sharing is something you
  // choose, never something you discover you were already doing.
  /** Off: friends see your time split across "Track 1, Track 2…". */
  shareTrackNames: boolean("share_track_names").notNull().default(false),
  /** On: friends see a "Studying now" badge while your timer runs. */
  shareLiveStatus: boolean("share_live_status").notNull().default(false),

  // Push reminders, all off until you choose them. Delivered to every device
  // you enabled notifications on.
  /** Evening: tasks due tomorrow. */
  remindDeadlines: boolean("remind_deadlines").notNull().default(false),
  /** Evening: how far you are from today's daily goal, if you are short. */
  remindDailyGoal: boolean("remind_daily_goal").notNull().default(false),
  /** Instantly: someone in one of your rooms started focusing there. */
  notifyRoomActivity: boolean("notify_room_activity").notNull().default(false),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));

export type UserSettings = typeof userSettings.$inferSelect;
