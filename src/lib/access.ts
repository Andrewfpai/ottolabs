/**
 * Owners: the people named in ALLOWED_EMAILS.
 *
 * They are always allowed in and are the only ones who can manage the invite
 * list. Living in the environment rather than the database is the point: on a
 * fresh database something outside the app has to say who the owner is, or
 * "first person to sign in" would claim a public URL. Read from the
 * environment on every call, so a change in Vercel takes effect on the next
 * deploy without touching data.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function ownerEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(email) && ownerEmails().includes(normalizeEmail(email!));
}
