"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";

/**
 * Rejects anything the runtime does not recognise as an IANA zone. The value
 * reaches us from the browser and is fed straight into date bucketing, so a
 * junk string would poison every analytic that depends on it.
 */
const timezoneSchema = z.string().refine(
  (value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Not a recognised IANA time zone" },
);

/**
 * Adopt the browser's time zone, but only while the stored value is still the
 * untouched default. Once someone picks a zone in Settings deliberately, a
 * laptop opened in another country must not silently overwrite it.
 */
export async function adoptBrowserTimezone(candidate: string): Promise<void> {
  const user = await requireUser();

  const parsed = timezoneSchema.safeParse(candidate);
  if (!parsed.success) return;

  const current = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, user.id),
    columns: { timezone: true },
  });

  if (!current || current.timezone !== "UTC" || parsed.data === "UTC") return;

  await db
    .update(userSettings)
    .set({ timezone: parsed.data })
    .where(eq(userSettings.userId, user.id));
}

export async function setTimezone(candidate: string): Promise<void> {
  const user = await requireUser();

  const parsed = timezoneSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`Unrecognised time zone: ${candidate}`);
  }

  await db
    .update(userSettings)
    .set({ timezone: parsed.data })
    .where(eq(userSettings.userId, user.id));
}
