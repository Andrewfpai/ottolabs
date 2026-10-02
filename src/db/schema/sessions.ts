/**
 * Focus sessions — the core of the app.
 *
 * NAMING: Auth.js already owns a table called `sessions` (login sessions).
 * This one is `focus_sessions` and the distinction is load-bearing. Do not
 * shorten it.
 *
 * TIME MODEL: we store *timestamps*, never a running counter. Elapsed time is
 * always derived as `(endedAt ?? now) - startedAt - pausedMs - livePause`.
 * See `src/lib/time/elapsed.ts` — that function is the single source of truth
 * and is used by both the ticking client display and server-side aggregation.
 * A row with `endedAt IS NULL` is live.
 */
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { tracks } from "./tracks";

export const sessionModeEnum = pgEnum("session_mode", ["stopwatch", "pomodoro"]);

export const sessionEndReasonEnum = pgEnum("session_end_reason", [
  /** User pressed Finish. */
  "manual",
  /** Heartbeat went stale and the reaper closed it at the last heartbeat. */
  "auto_closed",
  /** User threw the session away (idle prompt, or misfire). */
  "discarded",
  /** Typed in by hand after the fact, for time that wasn't tracked live. */
  "manual_entry",
]);

export type PomodoroConfig = {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
};

export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // restrict, not cascade: deleting a track must never silently erase history.
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "restrict" }),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    /** NULL means the session is live right now. */
    endedAt: timestamp("ended_at", { withTimezone: true }),

    /** Accumulated completed pauses, in ms. */
    pausedMs: integer("paused_ms").notNull().default(0),
    /** Non-null means currently paused; the open pause is not yet in pausedMs. */
    pausedAt: timestamp("paused_at", { withTimezone: true }),

    /** Pomodoro break time. Reported separately; never counted as focus. */
    breakMs: integer("break_ms").notNull().default(0),
    /**
     * Non-null means the pause currently open is a pomodoro break rather than
     * a manual pause. Both stop focus time accruing; only this one is also
     * tallied into `breakMs`, and without the flag a pause taken during a
     * pomodoro session would be indistinguishable from a break when it is
     * closed by Finish or by the reaper.
     */
    breakStartedAt: timestamp("break_started_at", { withTimezone: true }),

    mode: sessionModeEnum("mode").notNull().default("stopwatch"),
    pomodoroConfig: jsonb("pomodoro_config").$type<PomodoroConfig>(),
    completedCycles: integer("completed_cycles").notNull().default(0),

    /** The "what did I actually do?" journal entry, captured on finish. */
    note: text("note"),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),

    /** Updated ~every 60s while running. Drives the stale-session reaper. */
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    endReason: sessionEndReasonEnum("end_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // At most one live session per user, enforced by the database rather than
    // by application logic. A second "start" hits this and returns 409.
    uniqueIndex("focus_sessions_one_live_per_user")
      .on(t.userId)
      .where(sql`${t.endedAt} is null`),

    index("focus_sessions_user_started_idx").on(t.userId, t.startedAt.desc()),
    index("focus_sessions_track_started_idx").on(t.trackId, t.startedAt.desc()),
    // Partial index the reaper cron scans every 15 minutes.
    index("focus_sessions_live_heartbeat_idx")
      .on(t.lastHeartbeatAt)
      .where(sql`${t.endedAt} is null`),
  ],
);

export const focusSessionsRelations = relations(focusSessions, ({ one }) => ({
  user: one(users, { fields: [focusSessions.userId], references: [users.id] }),
  track: one(tracks, { fields: [focusSessions.trackId], references: [tracks.id] }),
}));

export type FocusSession = typeof focusSessions.$inferSelect;
export type NewFocusSession = typeof focusSessions.$inferInsert;
