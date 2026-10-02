/**
 * Friendships: mutual, and only after the other person accepts.
 *
 * A row is a request until `status` is `accepted`. Declining or cancelling
 * deletes it, so either side can ask again later; unfriending deletes it too.
 *
 * One row per pair regardless of who asked: the unique index is on the
 * (smaller id, larger id) pair, so A→B and B→A can never both exist and
 * disagree about whether the two are friends.
 */
import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const friendshipStatusEnum = pgEnum("friendship_status", ["pending", "accepted"]);

export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("friendships_pair_unique").on(
      sql`least(${t.requesterId}, ${t.addresseeId})`,
      sql`greatest(${t.requesterId}, ${t.addresseeId})`,
    ),
    index("friendships_addressee_idx").on(t.addresseeId),
    index("friendships_requester_idx").on(t.requesterId),
    check("friendships_not_self", sql`${t.requesterId} <> ${t.addresseeId}`),
  ],
);

export type Friendship = typeof friendships.$inferSelect;
