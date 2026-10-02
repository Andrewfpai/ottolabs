"use client";

import { useEffect, useState } from "react";

import type { LiveStatus } from "@/features/friends/server/queries";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { now as clockNow } from "@/lib/time/clock";
import { elapsedMs, formatCompact } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

/** Minutes are enough for someone else's timer; no need to tick every second. */
const TICK_MS = 30_000;

/**
 * "Studying now · Track 2 · 42m" for a friend who shares their live status.
 * The minutes are computed from the session's timestamps with the
 * server-corrected clock, and only after hydration so the server render and
 * the browser agree.
 */
export function LiveBadge({ live, className }: { live: LiveStatus; className?: string }) {
  const hydrated = useIsHydrated();
  const paused = live.pausedAt !== null;

  const [, repaint] = useState(0);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => repaint((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [paused]);

  const minutes = hydrated ? formatCompact(elapsedMs(live, clockNow())) : null;

  return (
    <span
      className={cn(
        "bg-primary/10 text-primary inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          paused ? "bg-muted-foreground" : "bg-primary motion-safe:animate-pulse",
        )}
      />
      <span className="truncate">
        {paused ? "Paused" : "Studying now"} ·{" "}
        <span
          aria-hidden
          className={cn("mr-1 inline-block size-1.5 rounded-full align-middle", trackColorClasses(live.trackColor).bg)}
        />
        {live.trackLabel}
        {minutes ? <span className="font-numeric"> · {minutes}</span> : null}
      </span>
    </span>
  );
}
