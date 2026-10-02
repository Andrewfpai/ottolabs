/**
 * To-dos with optional deadlines, optionally attached to a Track.
 *
 * The `google*` / `syncState` columns are unused in v1 and intentionally
 * nullable. They exist now so that adding Google Calendar sync in v1.1 is a
 * feature, not a migration against a table that already holds real data.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { tracks } from "./tracks";

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", ["p1", "p2", "p3"]);

export const syncStateEnum = pgEnum("sync_state", [
  "local",
  "synced",
  "pending_push",
  "conflict",
]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // set null, not restrict: deleting a track should orphan its tasks, not block.
    trackId: uuid("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),

    title: text("title").notNull(),
    notes: text("notes"),

    /** Null = no deadline (a "someday" item). */
    dueAt: timestamp("due_at", { withTimezone: true }),
    /** True = the time component of dueAt is meaningless; render as a date. */
    isAllDay: boolean("is_all_day").notNull().default(false),

    status: taskStatusEnum("status").notNull().default("todo"),
    priority: taskPriorityEnum("priority").notNull().default("p3"),

    completedAt: timestamp("completed_at", { withTimezone: true }),

    /**
     * Spaced review of a finished task: 0 means none scheduled; 1–3 means
     * waiting for that review, due at `reviewDueAt` (the start of the due
     * day in your zone). See `features/tasks/lib/reviews.ts`.
     */
    reviewStage: smallint("review_stage").notNull().default(0),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
    /** Reviews completed, ever. Counts toward milestones. */
    reviewsDone: smallint("reviews_done").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),

    // ── v1.1 Google Calendar sync. Unused in v1. ──
    googleEventId: text("google_event_id"),
    googleCalendarId: text("google_calendar_id"),
    googleEtag: text("google_etag"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    syncState: syncStateEnum("sync_state").notNull().default("local"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tasks_user_due_idx").on(t.userId, t.dueAt),
    index("tasks_user_status_idx").on(t.userId, t.status),
    index("tasks_track_idx").on(t.trackId),
    index("tasks_user_review_idx").on(t.userId, t.reviewDueAt).where(sql`${t.reviewDueAt} is not null`),
    // One local task per Google event, so a re-sync can't duplicate rows.
    uniqueIndex("tasks_google_event_unique").on(t.userId, t.googleEventId),
  ],
);

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  track: one(tracks, { fields: [tasks.trackId], references: [tracks.id] }),
}));

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
