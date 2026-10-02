/**
 * Web Push: devices that asked to be notified, and a log so the same reminder
 * is never sent twice.
 *
 * A subscription's endpoint is a capability URL issued by the browser's push
 * service (Apple, Google, Mozilla); anyone holding it plus the keys can push
 * to that device, so it is stored per user and never shown back.
 */
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** "Chrome on Windows", "Safari on iPhone" — so you can tell devices apart. */
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One row per device: re-subscribing the same browser updates, not duplicates.
    uniqueIndex("push_subscriptions_endpoint_unique").on(t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);

export const reminderLog = pgTable(
  "reminder_log",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** What was sent and for which day or event: "deadlines:2026-10-03". */
    key: text("key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reminder_log_user_key_unique").on(t.userId, t.key)],
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
