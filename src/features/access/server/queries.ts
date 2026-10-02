import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { allowedEmails, users } from "@/db/schema";
import { ownerEmails } from "@/lib/access";
import { isOwner } from "@/lib/auth-guard";

export type Invite = {
  email: string;
  createdAt: Date;
  /** True once the person has signed in at least once. */
  hasSignedIn: boolean;
};

export type AccessList = { owners: string[]; invites: Invite[] };

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

  return {
    owners: ownerEmails(),
    invites: rows.map((r) => ({
      email: r.email,
      createdAt: r.createdAt,
      hasSignedIn: r.userId !== null,
    })),
  };
}
