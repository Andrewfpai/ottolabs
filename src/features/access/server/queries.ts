import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { allowedEmails, inviteLinks, users } from "@/db/schema";
import { ownerEmails } from "@/lib/access";
import { isOwner } from "@/lib/auth-guard";

export type Invite = {
  email: string;
  createdAt: Date;
  /** True once the person has signed in at least once. */
  hasSignedIn: boolean;
};

export type InviteLinkRow = {
  id: string;
  label: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  usedByEmail: string | null;
};

export type AccessList = { owners: string[]; invites: Invite[]; links: InviteLinkRow[]; now: number };

/** The access list, for owners only; anyone else gets null. */
export async function getAccessList(): Promise<AccessList | null> {
  if (!(await isOwner())) return null;

  const rows = await db
    .select({
      email: allowedEmails.email,
      createdAt: allowedEmails.createdAt,
      userId: users.id,
    })
    .from(allowedEmails)
    .leftJoin(users, eq(sql`lower(${users.email})`, allowedEmails.email))
    .orderBy(asc(allowedEmails.createdAt));

  const links = await db
    .select({
      id: inviteLinks.id,
      label: inviteLinks.label,
      createdAt: inviteLinks.createdAt,
      expiresAt: inviteLinks.expiresAt,
      usedAt: inviteLinks.usedAt,
      usedByEmail: inviteLinks.usedByEmail,
    })
    .from(inviteLinks)
    .orderBy(desc(inviteLinks.createdAt))
    .limit(20);

  return {
    links,
    now: Date.now(),
    owners: ownerEmails(),
    invites: rows.map((r) => ({
      email: r.email,
      createdAt: r.createdAt,
      hasSignedIn: r.userId !== null,
    })),
  };
}
