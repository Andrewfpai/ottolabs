/**
 * Making, checking and spending invite links. Not a "use server" file: the
 * sign-in callback and the invite page call these with values they already
 * trust; the owner-facing actions live in `actions.ts`.
 */
import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { allowedEmails, inviteLinks, users } from "@/db/schema";
import { looksLikeInviteToken } from "@/features/access/lib/invite-links";
import { displayName } from "@/features/friends/lib/sharing";
import { normalizeEmail } from "@/lib/access";

export function newInviteToken(): string {
  // 24 random bytes → 32 base64url characters.
  return randomBytes(24).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** An open invite, for the invite page: who it is for and who sent it. */
export async function peekInvite(token: string): Promise<{ label: string; from: string; expiresAt: Date } | null> {
  if (!looksLikeInviteToken(token)) return null;
  const [row] = await db
    .select({
      label: inviteLinks.label,
      expiresAt: inviteLinks.expiresAt,
      name: users.name,
      email: users.email,
    })
    .from(inviteLinks)
    .leftJoin(users, eq(users.id, inviteLinks.createdBy))
    .where(
      and(
        eq(inviteLinks.tokenHash, hashInviteToken(token)),
        isNull(inviteLinks.usedAt),
        gt(inviteLinks.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    label: row.label,
    expiresAt: row.expiresAt,
    from: row.email ? displayName({ name: row.name, email: row.email }) : "An owner",
  };
}

/**
 * Spend an invite on this Google address: mark it used and add the address
 * to the invite list. The update is the lock — of two sign-ins racing on the
 * same link, only one finds it unused. Returns whether access was granted.
 */
export async function redeemInvite(token: string, email: string): Promise<boolean> {
  if (!looksLikeInviteToken(token)) return false;
  const address = normalizeEmail(email);

  const [spent] = await db
    .update(inviteLinks)
    .set({ usedAt: new Date(), usedByEmail: address })
    .where(
      and(
        eq(inviteLinks.tokenHash, hashInviteToken(token)),
        isNull(inviteLinks.usedAt),
        gt(inviteLinks.expiresAt, new Date()),
      ),
    )
    .returning({ createdBy: inviteLinks.createdBy });
  if (!spent) return false;

  await db
    .insert(allowedEmails)
    .values({ email: address, invitedBy: spent.createdBy })
    .onConflictDoNothing();
  return true;
}
