/**
 * Milestones reached. A row is written the first time a milestone is met and
 * never removed, so an unlock survives deleting the sessions that earned it.
 * The milestones themselves are code: `features/achievements/lib/milestones.ts`.
 */
import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const achievements = pgTable(
  "achievements",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** A milestone id, e.g. "hours-50". */
    key: text("key").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    /** Null until the unlock has been celebrated in the app. */
    seenAt: timestamp("seen_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] }), index("achievements_user_idx").on(t.userId)],
);

export type Achievement = typeof achievements.$inferSelect;
