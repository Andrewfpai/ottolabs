"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { TrackIcon } from "@/components/track-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/features/sessions/components/tag-input";
import { useFinishSession } from "@/features/sessions/hooks/use-active-session";
import { MY_TAGS_KEY, useMyTags } from "@/features/sessions/hooks/use-my-tags";
import type { SessionWithTrack } from "@/features/sessions/server/queries";
import { formatCompact, formatDuration } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

/**
 * The note prompt on finish.
 *
 * Asking "what did you actually do?" at the one moment you still remember turns
 * a row of hours into something worth reading back. It is optional and Escape
 * saves without it — a prompt you cannot skip is a prompt that stops you
 * starting the timer at all.
 */
export function FinishSessionDialog({
  session,
  frozenMs,
  open,
  onOpenChange,
}: {
  session: SessionWithTrack;
  /**
   * Elapsed time captured at the instant Finish was pressed.
   *
   * Passed in rather than computed here: the session is still live until the
   * save lands, so recomputing on render would make the number climb while you
   * are writing the note. Freezing it at the click is both correct and avoids
   * an effect that only exists to copy a value into state.
   */
  frozenMs: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [note, setNote] = useState(session.note ?? "");
  // Opening the dialog starts from whatever was written in focus mode's notes.
  // Adjusted during render rather than in an effect (react.dev, "You might not
  // need an effect").
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setNote(session.note ?? "");
  }
  const [tags, setTags] = useState<string[]>([]);
  const [completeTask, setCompleteTask] = useState(false);
  const [reviewTask, setReviewTask] = useState(false);
  const finish = useFinishSession();
  const queryClient = useQueryClient();
  const suggestions = useMyTags(open);

  const colors = trackColorClasses(session.track.color);

  async function submit() {
    try {
      const result = await finish.mutateAsync({
        id: session.id,
        note,
        tags,
        completeTask,
        reviewTask: completeTask && reviewTask,
      });
      toast.success(
        `Logged ${formatCompact(result.elapsedMs)} on ${session.task?.title ?? session.track.title}.` +
          (session.task && completeTask ? " Task done." : ""),
      );
      if (tags.length > 0) void queryClient.invalidateQueries({ queryKey: MY_TAGS_KEY });
      setNote("");
      setTags([]);
      setCompleteTask(false);
      setReviewTask(false);
      onOpenChange(false);
    } catch {
      // useSessionMutation already surfaced the error as a toast.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                colors.surface,
                colors.text,
              )}
            >
              <TrackIcon name={session.track.icon} className="size-3.5" />
            </span>
            <span className="min-w-0 truncate">
              {session.track.title}
              {session.task ? (
                <span className="text-muted-foreground font-normal"> · {session.task.title}</span>
              ) : null}
            </span>
          </DialogTitle>
          <DialogDescription>
            <span className="font-numeric text-foreground text-3xl font-medium">
              {formatDuration(frozenMs)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="session-note" className="text-sm font-medium">
            What did you actually do?
          </label>
          <Textarea
            id="session-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Worked through the indexing chapter. B-trees finally clicked."
            rows={4}
            autoFocus
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <p className="text-muted-foreground text-xs">
            Optional. ⌘/Ctrl + Enter to save.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="session-tags" className="text-sm font-medium">
            Tags <span className="text-muted-foreground font-normal">optional</span>
          </label>
          <TagInput id="session-tags" value={tags} onChange={setTags} suggestions={suggestions} />
        </div>

        {session.task ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={completeTask}
              onCheckedChange={(checked) => setCompleteTask(checked === true)}
              className="cursor-pointer"
            />
            Mark “{session.task.title}” as done
          </label>
        ) : null}
        {session.task && completeTask ? (
          <label className="-mt-2 ml-6 flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={reviewTask}
              onCheckedChange={(checked) => setReviewTask(checked === true)}
              className="cursor-pointer"
            />
            Review it in 3, 7 and 21 days
          </label>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            className="cursor-pointer"
            disabled={finish.isPending}
            onClick={() => void submit()}
          >
            Skip note
          </Button>
          <Button
            className="cursor-pointer"
            disabled={finish.isPending}
            aria-busy={finish.isPending}
            onClick={() => void submit()}
          >
            {finish.isPending ? "Saving…" : "Save session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
