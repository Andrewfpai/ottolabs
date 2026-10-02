/**
 * Invite link rules, pure so they are tested. Tokens themselves are made and
 * hashed on the server (`server/invite-links.ts`).
 */
export const INVITE_COOKIE = "ottolabs_invite";
/** Long enough to finish a Google sign-in, short enough not to linger. */
export const INVITE_COOKIE_MAX_AGE_S = 15 * 60;

export const INVITE_EXPIRY_OPTIONS = [
  { hours: 24, label: "24 hours" },
  { hours: 24 * 7, label: "7 days" },
] as const;

export type InviteStatus = "waiting" | "used" | "expired";

export function inviteStatus(link: { usedAt: Date | null; expiresAt: Date }, now: number): InviteStatus {
  if (link.usedAt) return "used";
  return link.expiresAt.getTime() <= now ? "expired" : "waiting";
}

/** Tokens are 32 base64url characters; anything else is not worth a lookup. */
export function looksLikeInviteToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(value);
}

/** "in 23 hours", "in 6 days". */
export function expiresIn(expiresAt: Date, now: number): string {
  const hours = Math.max(0, Math.round((expiresAt.getTime() - now) / 3_600_000));
  if (hours < 1) return "within the hour";
  if (hours < 48) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  return `in ${Math.round(hours / 24)} days`;
}
