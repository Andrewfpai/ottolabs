"use client";

import { useEffect, useRef } from "react";

import { adoptBrowserTimezone } from "@/features/settings/server/actions";

/**
 * Records the browser's time zone the first time you sign in.
 *
 * Every date bucket in the app — daily totals, streaks, the contribution
 * heatmap, the hour-of-day profile — is computed in the user's zone. Leaving
 * that at the UTC default silently shifts a Jakarta evening into the small
 * hours of the following morning, which looks like an analytics bug and is not
 * one. The server ignores the value unless the stored zone is still `UTC`.
 */
export function TimezoneSync({ currentTimezone }: { currentTimezone: string }) {
  // Effects run twice in dev Strict Mode; this keeps it to a single call.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || currentTimezone !== "UTC") return;

    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserZone || browserZone === "UTC") return;

    sent.current = true;
    void adoptBrowserTimezone(browserZone).catch(() => {
      // Non-fatal. The zone stays at UTC and is editable in Settings.
      sent.current = false;
    });
  }, [currentTimezone]);

  return null;
}
