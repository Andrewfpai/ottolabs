"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  Ban,
  CalendarClock,
  CircleDot,
  Flag,
  MoreVertical,
  Pencil,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { describeDue, isOpen, type TaskStatus } from "@/features/tasks/lib/due";
import { DUE_TONE_CLASSES, PRIORITY_META } from "@/features/tasks/lib/labels";
import { setTaskStatus } from "@/features/tasks/server/actions";
import type { TaskWithTrack } from "@/features/tasks/server/queries";
import { dayKey, formatDayKey } from "@/lib/time/calendar-day";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

const STATUS_TOASTS: Record<TaskStatus, string> = {
  todo: "Moved back to to-do.",
  in_progress: "Marked in progress.",
  done: "Task done.",
  cancelled: "Task cancelled.",
};

export function TaskRow({
  task,
  now,
  timeZone,
  onEdit,
  onDelete,
}: {
  task: TaskWithTrack;
  /** The board's grouping instant — see `TaskBoard.now`. */
  now: number;
  timeZone: string;
  onEdit: (task: TaskWithTrack) => void;
  onDelete: (task: TaskWithTrack) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [, startTransition] = useTransition();
  // The checkbox answers instantly; the row moves to its new section when the
  // revalidated list arrives a moment later.
  const [status, setOptimisticStatus] = useOptimistic(task.status);

  const open = isOpen(status);
  const due = open ? describeDue(task, now, timeZone) : null;
  const priority = PRIORITY_META[task.priority];

  function changeStatus(next: TaskStatus) {
    const previous = task.status;

    startTransition(async () => {
      setOptimisticStatus(next);
      const result = await setTaskStatus({ id: task.id, status: next });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(STATUS_TOASTS[next], {
        action: {
          label: "Undo",
          onClick: () => {
            void setTaskStatus({ id: task.id, status: previous }).then((undo) => {
              if (!undo.ok) toast.error(undo.error);
            });
          },
        },
      });
    });
  }

  const closedLabel =
    status === "done" && task.completedAt
      ? `Done ${formatDayKey(dayKey(task.completedAt, timeZone), { day: "numeric", month: "short" })}`
      : null;

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="group hover:bg-muted/40 flex items-start gap-3 px-3 py-2.5 transition-colors"
    >
      <Checkbox
        checked={status === "done"}
        onCheckedChange={() => changeStatus(status === "done" ? "todo" : "done")}
        aria-label={
          status === "done" ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`
        }
        className="mt-0.5 cursor-pointer"
      />

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className={cn(
            "block w-full cursor-pointer text-left text-sm font-medium break-words",
            !open && "text-muted-foreground line-through decoration-1",
          )}
        >
          {task.title}
        </button>

        {task.notes ? (
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{task.notes}</p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {due ? (
            <span
              className={cn("flex items-center gap-1", DUE_TONE_CLASSES[due.tone])}
              title={due.full}
            >
              <CalendarClock className="size-3.5" aria-hidden />
              <span className="font-numeric">{due.text}</span>
              <span className="sr-only">, due {due.full}</span>
            </span>
          ) : null}

          {closedLabel ? <span className="text-muted-foreground">{closedLabel}</span> : null}

          {status === "cancelled" ? (
            <Badge variant="outline" className="text-xs">
              Cancelled
            </Badge>
          ) : null}

          {status === "in_progress" ? (
            <Badge variant="secondary" className="text-xs">
              In progress
            </Badge>
          ) : null}

          {open && task.priority !== "p3" ? (
            <span className={cn("flex items-center gap-1", priority.className)}>
              <Flag className="size-3.5" aria-hidden />
              {priority.label}
            </span>
          ) : null}

          {task.track ? (
            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  trackColorClasses(task.track.color).bg,
                )}
              />
              <span className="truncate">{task.track.title}</span>
            </span>
          ) : null}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground -my-1 size-8 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-sm:opacity-100"
            aria-label={`Actions for “${task.title}”`}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem className="cursor-pointer gap-2" onSelect={() => onEdit(task)}>
            <Pencil className="size-4" aria-hidden />
            Edit
          </DropdownMenuItem>

          {status === "todo" ? (
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => changeStatus("in_progress")}
            >
              <CircleDot className="size-4" aria-hidden />
              Mark in progress
            </DropdownMenuItem>
          ) : null}
          {status === "in_progress" ? (
            <DropdownMenuItem className="cursor-pointer gap-2" onSelect={() => changeStatus("todo")}>
              <Undo2 className="size-4" aria-hidden />
              Move back to to-do
            </DropdownMenuItem>
          ) : null}
          {open ? (
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => changeStatus("cancelled")}
            >
              <Ban className="size-4" aria-hidden />
              Cancel task
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="cursor-pointer gap-2" onSelect={() => changeStatus("todo")}>
              <RotateCcw className="size-4" aria-hidden />
              Reopen
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer gap-2"
            onSelect={() => onDelete(task)}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  );
}
