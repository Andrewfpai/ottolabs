"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AgendaList } from "@/features/calendar/components/agenda-list";
import { MonthGrid, WeekGrid } from "@/features/calendar/components/calendar-grids";
import { CALENDAR_VIEWS, calendarHref, type CalendarView as View } from "@/features/calendar/lib/range";
import type { CalendarData } from "@/features/calendar/server/queries";
import { DeleteTaskDialog } from "@/features/tasks/components/delete-task-dialog";
import { TaskFormDialog, type TaskFormDefaults } from "@/features/tasks/components/task-form-dialog";
import type { TaskWithTrack } from "@/features/tasks/server/queries";
import type { TrackOption } from "@/features/tracks/server/queries";
import type { DayKey } from "@/lib/time/calendar-day";
import { formatCompact } from "@/lib/time/elapsed";
import { cn } from "@/lib/utils";

const VIEW_LABELS: Record<View, string> = { month: "Month", week: "Week", agenda: "Agenda" };

const STEP_LABELS: Record<View, [string, string]> = {
  month: ["Previous month", "Next month"],
  week: ["Previous week", "Next week"],
  agenda: ["Previous four weeks", "Next four weeks"],
};

type FormState = {
  open: boolean;
  /** Bumped on every open so the form remounts with fresh fields. */
  generation: number;
  task?: TaskWithTrack;
  defaults?: TaskFormDefaults;
};

export function CalendarView({ data, tracks }: { data: CalendarData; tracks: TrackOption[] }) {
  const router = useRouter();
  const [toggling, startToggle] = useTransition();
  const [form, setForm] = useState<FormState>({ open: false, generation: 0 });
  const [deleting, setDeleting] = useState<TaskWithTrack | null>(null);

  const { range, focusByDay } = data;
  const showFocus = focusByDay !== null;
  const href = (view: View, anchor: DayKey) => calendarHref(view, anchor, showFocus);
  const [prevLabel, nextLabel] = STEP_LABELS[range.view];

  const totalFocusMs = focusByDay
    ? Object.values(focusByDay).reduce((sum, ms) => sum + ms, 0)
    : 0;

  const handlers = {
    onEdit: (task: TaskWithTrack) =>
      setForm((f) => ({ open: true, generation: f.generation + 1, task })),
    onCreate: (day: DayKey) =>
      setForm((f) => ({ open: true, generation: f.generation + 1, defaults: { dueDate: day } })),
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <Link href={href(range.view, data.todayKey)}>Today</Link>
          </Button>
          <div className="flex">
            <Button asChild variant="ghost" size="icon" className="size-8 cursor-pointer">
              <Link href={href(range.view, range.prev)} aria-label={prevLabel}>
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="size-8 cursor-pointer">
              <Link href={href(range.view, range.next)} aria-label={nextLabel}>
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <h2 className="text-lg font-semibold" aria-live="polite">
            {range.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="calendar-focus"
              checked={showFocus}
              onCheckedChange={(checked) =>
                startToggle(() =>
                  router.replace(calendarHref(range.view, range.anchor, checked), { scroll: false }),
                )
              }
              disabled={toggling}
              className="cursor-pointer"
            />
            <Label htmlFor="calendar-focus" className="cursor-pointer text-sm font-normal">
              Focus time
            </Label>
          </div>

          <nav aria-label="Calendar view" className="flex rounded-lg border p-0.5">
            {CALENDAR_VIEWS.map((view) => (
              <Link
                key={view}
                href={href(view, range.anchor)}
                aria-current={view === range.view ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors",
                  view === range.view
                    ? "bg-muted font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {VIEW_LABELS[view]}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {showFocus ? (
        <p className="text-muted-foreground mb-3 text-sm">
          <span className="text-foreground font-medium">
            {formatCompact(totalFocusMs)}
          </span>{" "}
          focused in this view. Sessions count toward the day they started on.
        </p>
      ) : null}

      <div className={cn("transition-opacity", toggling && "opacity-60")} aria-busy={toggling}>
        {range.view === "month" ? <MonthGrid data={data} {...handlers} /> : null}
        {range.view === "week" ? <WeekGrid data={data} {...handlers} /> : null}
        {range.view === "agenda" ? (
          <AgendaList data={data} {...handlers} onDelete={setDeleting} />
        ) : null}
      </div>

      <TaskFormDialog
        key={form.generation}
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        task={form.task}
        defaults={form.defaults}
        tracks={tracks}
        timeZone={data.timeZone}
        todayKey={data.todayKey}
        weekStartsOn={data.weekStartsOn}
        defaultReminders={data.defaultReminders}
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
