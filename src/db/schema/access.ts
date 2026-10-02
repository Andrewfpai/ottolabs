/**
 * Who besides the owners may sign in.
 *
 * Owners are not stored here: they come from ALLOWED_EMAILS in the
 * environment, which is what lets an owner in on an empty database and keeps
 * them from being locked out by a bad edit here. This table is the invite
 * list owners manage from Settings → Access.
 *
 * Emails are stored lowercase, enforced by a check constraint rather than
 * trusted to every caller, so "Friend@Gmail.com" and "friend@gmail.com" can
 * never be two rows that disagree.
 */
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const allowedEmails = pgTable(
  "allowed_emails",
  {
    email: text("email").primaryKey(),
    // set null: removing the inviter's account must not revoke their invites.
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("allowed_emails_lowercase", sql`${t.email} = lower(${t.email})`)],
);

export type AllowedEmail = typeof allowedEmails.$inferSelect;
