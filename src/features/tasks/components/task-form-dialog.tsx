"use client";

import { CalendarDays, Flag, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskPriority, TaskStatus } from "@/features/tasks/lib/due";
import { PRIORITY_META, STATUS_LABELS } from "@/features/tasks/lib/labels";
import {
  createTaskSchema,
  TASK_PRIORITIES,
  TASK_STATUSES,
  updateTaskSchema,
} from "@/features/tasks/schema";
import { createTask, updateTask } from "@/features/tasks/server/actions";
import type { TaskWithTrack } from "@/features/tasks/server/queries";
import type { TrackOption } from "@/features/tracks/server/queries";
import {
  addDays,
  type DayKey,
  dayKey,
  dayKeyToLocalDate,
  formatDayKey,
  localDateToDayKey,
  timeOfDay,
} from "@/lib/time/calendar-day";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

/** Radix Select reserves the empty string, so "no track" needs a sentinel. */
const NO_TRACK = "none";

export type TaskFormDefaults = {
  title?: string;
  trackId?: string | null;
  dueDate?: DayKey | null;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaults,
  tracks,
  timeZone,
  todayKey,
  weekStartsOn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create. */
  task?: TaskWithTrack;
  /** Prefill for a new task — the quick-add text, the filtered track, a clicked day. */
  defaults?: TaskFormDefaults;
  tracks: TrackOption[];
  timeZone: string;
  todayKey: DayKey;
  weekStartsOn: 0 | 1;
}) {
  const isEdit = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? defaults?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [trackId, setTrackId] = useState(
    (task ? task.trackId : defaults?.trackId) ?? NO_TRACK,
  );
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "p3");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [dueDate, setDueDate] = useState<DayKey | null>(
    task ? (task.dueAt ? dayKey(task.dueAt, timeZone) : null) : (defaults?.dueDate ?? null),
  );
  const [dueTime, setDueTime] = useState(
    task?.dueAt && !task.isAllDay ? timeOfDay(task.dueAt, timeZone) : "",
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Archived tracks are not offered for new links, but one already attached
  // has to stay visible or the select would show a blank.
  const trackChoices = tracks.filter((t) => t.status !== "archived" || t.id === trackId);

  function pickDate(key: DayKey | null) {
    setDueDate(key);
    if (key === null) setDueTime("");
    setPickerOpen(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const fields = {
      title,
      notes,
      trackId: trackId === NO_TRACK ? null : trackId,
      priority,
      dueDate,
      dueTime: dueDate && dueTime ? dueTime : null,
    };

    // Same schema the server runs, so obvious mistakes never leave the browser.
    const check = isEdit
      ? updateTaskSchema.safeParse({ ...fields, id: task!.id, status })
      : createTaskSchema.safeParse(fields);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "That does not look right.");
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateTask({ ...fields, id: task!.id, status })
        : await createTask(fields);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(isEdit ? "Task updated." : "Task added.");
      onOpenChange(false);
    });
  }

  const quickDates: { label: string; key: DayKey }[] = [
    { label: "Today", key: todayKey },
    { label: "Tomorrow", key: addDays(todayKey, 1) },
    { label: "In a week", key: addDays(todayKey, 7) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Change the details, the deadline, or where it stands."
                : "Something you mean to get done. A deadline is optional."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Finish chapter 4 exercises"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-due-date">Deadline</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="task-due-date"
                    type="button"
                    variant="outline"
                    className={cn(
                      "min-w-44 cursor-pointer justify-start gap-2 font-normal",
                      !dueDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarDays className="size-4" aria-hidden />
                    {dueDate
                      ? formatDayKey(dueDate, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "No deadline"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex gap-1 border-b p-2">
                    {quickDates.map((option) => (
                      <Button
                        key={option.label}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => pickDate(option.key)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <Calendar
                    mode="single"
                    selected={dueDate ? dayKeyToLocalDate(dueDate) : undefined}
                    defaultMonth={dayKeyToLocalDate(dueDate ?? todayKey)}
                    today={dayKeyToLocalDate(todayKey)}
                    weekStartsOn={weekStartsOn}
                    onSelect={(date) => pickDate(date ? localDateToDayKey(date) : null)}
                  />
                </PopoverContent>
              </Popover>

              <Input
                type="time"
                aria-label="Time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={!dueDate}
                className="tabular w-32 cursor-pointer"
              />

              {dueDate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground size-8 cursor-pointer"
                  aria-label="Remove deadline"
                  onClick={() => pickDate(null)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              {dueDate && !dueTime
                ? "No time set, so it is due any time that day."
                : `Times are in ${timeZone.replace(/_/g, " ")}.`}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span id="task-priority-label" className="text-sm leading-none font-medium">
                Priority
              </span>
              <div
                role="radiogroup"
                aria-labelledby="task-priority-label"
                className="flex gap-1 rounded-lg border p-1"
              >
                {TASK_PRIORITIES.map((value) => {
                  const meta = PRIORITY_META[value];
                  const selected = priority === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPriority(value)}
                      className={cn(
                        "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        selected ? "bg-muted font-medium" : "hover:bg-muted/50",
                      )}
                    >
                      <Flag className={cn("size-3.5", meta.className)} aria-hidden />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-track">Track</Label>
              <Select value={trackId} onValueChange={setTrackId}>
                <SelectTrigger id="task-track" className="w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TRACK} className="cursor-pointer">
                    No track
                  </SelectItem>
                  {trackChoices.map((track) => (
                    <SelectItem key={track.id} value={track.id} className="cursor-pointer">
                      <span
                        aria-hidden
                        className={cn("size-2 rounded-full", trackColorClasses(track.color).bg)}
                      />
                      {track.title}
                      {track.status === "archived" ? " (archived)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="task-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger id="task-status" className="w-full cursor-pointer sm:w-1/2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((value) => (
                    <SelectItem key={value} value={value} className="cursor-pointer">
                      {STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="task-notes">
              Notes <span className="text-muted-foreground font-normal">optional</span>
            </Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Links, page numbers, what done looks like…"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={pending || !title.trim()}
              aria-busy={pending}
            >
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
