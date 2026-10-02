/**
 * A track's study plan: the chapters, units or modules you are working
 * through, in order, each done or not. It turns "40 hours on Databases" into
 * "Chapter 6 of 12".
 *
 * Private: plans are never shown to friends or rooms.
 */
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { tracks } from "./tracks";

export const trackUnits = pgTable(
  "track_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // A plan belongs to its track: delete the track, the plan goes with it.
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Order within the track. Gaps are fine; only the order matters. */
    position: integer("position").notNull(),
    /** Null until ticked off. */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("track_units_track_position_idx").on(t.trackId, t.position),
    check("track_units_title_length", sql`char_length(${t.title}) between 1 and 120`),
  ],
);

export type TrackUnit = typeof trackUnits.$inferSelect;
