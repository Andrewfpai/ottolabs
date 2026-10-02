"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  useDiscardSession,
  useTrimIdleTime,
} from "@/features/sessions/hooks/use-active-session";
import type { SessionWithTrack } from "@/features/sessions/server/queries";
import { formatCompact } from "@/lib/time/elapsed";

/**
 * "Were you still focusing?" — asked when you come back to a timer that ran
 * while the tab was buried for a long time.
 *
 * The three answers are the three things that are actually true: you were
 * working elsewhere and it counts, you were away and it does not, or the whole
 * session was a misfire. Guessing on the user's behalf is what makes a tracker
 * untrustworthy; so is not asking at all.
 */
export function IdleReturnDialog({
  session,
  awayMs,
  onResolved,
}: {
  session: SessionWithTrack;
  awayMs: number;
  onResolved: () => void;
}) {
  const trim = useTrimIdleTime();
  const discard = useDiscardSession();
  const busy = trim.isPending || discard.isPending;

  return (
    <AlertDialog open onOpenChange={(open) => (!open ? onResolved() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Still focusing?</AlertDialogTitle>
          <AlertDialogDescription>
            This tab was in the background for{" "}
            <span className="text-foreground font-medium">
              {formatCompact(awayMs)}
            </span>{" "}
            while the timer on {session.track.title} kept running.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-destructive cursor-pointer"
            disabled={busy}
            onClick={() => {
              discard.mutate({ id: session.id });
              onResolved();
            }}
          >
            Discard session
          </Button>

          <AlertDialogAction
            className="cursor-pointer"
            disabled={busy}
            onClick={() => {
              trim.mutate({ id: session.id, awayMs });
              onResolved();
            }}
          >
            Trim {formatCompact(awayMs)}
          </AlertDialogAction>

          <AlertDialogCancel className="cursor-pointer" disabled={busy}>
            Keep it, I was working
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
