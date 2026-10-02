/**
 * A Track is a thing you are learning — "Databases", "Cybersecurity".
 * Focus sessions accumulate against it.
 */
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const trackStatusEnum = pgEnum("track_status", [
  "active",
  "paused",
  "archived",
]);

export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),

    /** Design-token name (e.g. "amber"), never a raw hex — keeps theming coherent. */
    color: text("color").notNull().default("amber"),
    /** lucide-react icon name. */
    icon: text("icon").notNull().default("book-open"),

    status: trackStatusEnum("status").notNull().default("active"),

    /** Weekly goal. Null = no target set for this track. */
    targetMinutesPerWeek: integer("target_minutes_per_week"),

    /** What the study plan calls its parts: "Chapter 6 of 12". */
    unitLabel: text("unit_label").notNull().default("Unit"),

    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Case-insensitive uniqueness: "Databases" and "databases" are the same track.
    uniqueIndex("tracks_user_title_unique").on(t.userId, sql`lower(${t.title})`),
    index("tracks_user_status_idx").on(t.userId, t.status),
  ],
);

export const tracksRelations = relations(tracks, ({ one }) => ({
  user: one(users, { fields: [tracks.userId], references: [users.id] }),
}));

export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;
