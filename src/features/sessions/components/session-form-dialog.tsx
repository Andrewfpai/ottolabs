"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Track } from "@/db/schema";
import { TagInput } from "@/features/sessions/components/tag-input";
import { useMyTags } from "@/features/sessions/hooks/use-my-tags";
import {
  createManualSession,
  updateSession,
} from "@/features/sessions/server/actions";
import { DeleteSessionDialog } from "@/features/sessions/components/delete-session";
import type { SessionWithTrack } from "@/features/sessions/server/queries";
import { elapsedMs, formatCompact } from "@/lib/time/elapsed";

/**
 * `datetime-local` speaks the browser's local time, and the app's stored zone
 * was captured from that same browser, so the two agree. If the user later sets
 * a different zone in Settings by hand, these fields still read as their own
 * wall clock — which is what someone typing a time actually means.
 */
function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function SessionFormDialog({
  open,
  onOpenChange,
  tracks,
  session,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracks: Track[];
  /** Omit to log a session by hand. */
  session?: SessionWithTrack;
}) {
  const isEdit = Boolean(session);
  const router = useRouter();

  const defaultEnd = new Date();
  const defaultStart = new Date(defaultEnd.getTime() - 60 * 60_000);

  const [trackId, setTrackId] = useState(session?.trackId ?? tracks[0]?.id ?? "");
  const [startedAt, setStartedAt] = useState(
    toDateTimeLocal(session?.startedAt ?? defaultStart),
  );
  const [endedAt, setEndedAt] = useState(
    toDateTimeLocal(session?.endedAt ?? defaultEnd),
  );
  const [note, setNote] = useState(session?.note ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [tags, setTags] = useState<string[]>(session?.tags ?? []);
  const suggestions = useMyTags(open);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const spanMs = end.getTime() - start.getTime();
  const spanValid = Number.isFinite(spanMs) && spanMs > 0;

  function submit() {
    setError(null);

    startTransition(async () => {
      const payload = {
        trackId,
        startedAt: start,
        endedAt: end,
        note,
        tags,
      };

      const result = isEdit
        ? await updateSession({ ...payload, id: session!.id })
        : await createManualSession(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(isEdit ? "Session updated." : "Session logged.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit session" : "Log a session"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Correct the track, the times, or what you wrote down."
              : "For time you focused but forgot to press Start on."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-track">Track</Label>
            <Select value={trackId} onValueChange={setTrackId}>
              <SelectTrigger id="session-track" className="w-full cursor-pointer">
                <SelectValue placeholder="Pick a track" />
              </SelectTrigger>
              <SelectContent>
                {tracks.map((track) => (
                  <SelectItem
                    key={track.id}
                    value={track.id}
                    className="cursor-pointer"
                  >
                    {track.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="session-start">Started</Label>
              <Input
                id="session-start"
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-end">Ended</Label>
              <Input
                id="session-end"
                type="datetime-local"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                className="cursor-pointer"
              />
            </div>
          </div>

          <p className="text-muted-foreground text-sm" aria-live="polite">
            {spanValid ? (
              <>
                Focus{" "}
                <span className="text-foreground font-numeric font-medium">
                  {/* What will be logged: the span less any recorded pause, the
                      same sum as everywhere else (elapsed.ts). */}
                  {formatCompact(
                    elapsedMs({
                      startedAt: start,
                      endedAt: end,
                      pausedMs: isEdit ? Math.min(session!.pausedMs, spanMs) : 0,
                      pausedAt: null,
                    }),
                  )}
                </span>
              </>
            ) : (
              "The end time has to be after the start time."
            )}
          </p>

          <div className="space-y-2">
            <Label htmlFor="session-form-note">
              Note{" "}
              <span className="text-muted-foreground font-normal">optional</span>
            </Label>
            <Textarea
              id="session-form-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What did you work through?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-form-tags">
              Tags <span className="text-muted-foreground font-normal">optional</span>
            </Label>
            <TagInput id="session-form-tags" value={tags} onChange={setTags} suggestions={suggestions} />
          </div>

          {error ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {session ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive mr-auto cursor-pointer gap-1.5"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            className="cursor-pointer"
            onClick={submit}
            disabled={pending || !spanValid || !trackId}
            aria-busy={pending}
          >
            {pending ? "Saving…" : isEdit ? "Save changes" : "Log session"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {session ? (
        <DeleteSessionDialog
          sessionId={session.id}
          summary={`${formatCompact(elapsedMs(session))} on ${session.track.title}`}
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          onDeleted={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}
