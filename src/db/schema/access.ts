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
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

/**
 * One-time invite links, so an owner can let someone in without knowing
 * their email. Whoever opens the link and signs in with Google first gets
 * that Google address added to `allowed_emails`; the link is then spent.
 *
 * Only a SHA-256 of the token is stored: the link is shown once, when it is
 * made, and a leaked database cannot be turned back into working links.
 */
export const inviteLinks = pgTable(
  "invite_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    /** Who it is for, in the owner's words: "Farrel". */
    label: text("label").notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedByEmail: text("used_by_email"),
  },
  (t) => [
    check("invite_links_label_length", sql`char_length(${t.label}) between 1 and 40`),
    index("invite_links_created_idx").on(t.createdAt),
  ],
);

export type InviteLink = typeof inviteLinks.$inferSelect;
