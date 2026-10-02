"use client";

import { Check, Repeat, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { REVIEW_COUNT, reviewLabel } from "@/features/tasks/lib/reviews";
import { completeReview, stopReviews } from "@/features/tasks/server/actions";
import type { TaskWithTrack } from "@/features/tasks/server/queries";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

/** Finished tasks that are due for another look today. */
export function ReviewList({ reviews }: { reviews: TaskWithTrack[] }) {
  if (reviews.length === 0) return null;

  return (
    <section aria-labelledby="tasks-reviews">
      <h2 id="tasks-reviews" className="text-primary mb-2 flex items-center gap-2 text-sm font-medium">
        <Repeat className="size-4" aria-hidden />
        Reviews due
        <span className="font-numeric font-normal">{reviews.length}</span>
      </h2>
      <ul className="bg-card divide-y overflow-hidden rounded-xl border">
        {reviews.map((task) => (
          <ReviewRow key={task.id} task={task} />
        ))}
      </ul>
    </section>
  );
}

function ReviewRow({ task }: { task: TaskWithTrack }) {
  const [pending, startTransition] = useTransition();

  function done() {
    startTransition(async () => {
      const result = await completeReview({ id: task.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.finished
          ? `All ${REVIEW_COUNT} reviews done. “${task.title}” should stick now.`
          : "Reviewed. The next one is scheduled.",
      );
    });
  }

  function stop() {
    startTransition(async () => {
      const result = await stopReviews({ id: task.id });
      if (!result.ok) toast.error(result.error);
      else toast.message(`Stopped reviewing “${task.title}”.`);
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
          <span>{reviewLabel(task.reviewStage)}</span>
          {task.track ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", trackColorClasses(task.track.color).bg)} />
              <span className="truncate">{task.track.title}</span>
            </span>
          ) : null}
        </div>
      </div>
      <Button size="sm" variant="outline" className="cursor-pointer gap-1.5" disabled={pending} onClick={done}>
        <Check className="size-3.5" aria-hidden />
        Reviewed
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="text-muted-foreground size-8 cursor-pointer"
        disabled={pending}
        onClick={stop}
        aria-label={`Stop reviewing “${task.title}”`}
        title="Stop reviewing"
      >
        <X className="size-4" aria-hidden />
      </Button>
    </li>
  );
}
