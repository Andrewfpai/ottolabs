"use client";

import { AnimatePresence } from "motion/react";
import { CalendarDays, Plus, Timer } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import type { GridHandlers } from "@/features/calendar/components/calendar-grids";
import type { CalendarData } from "@/features/calendar/server/queries";
import { TaskRow } from "@/features/tasks/components/task-row";
import type { TaskWithTrack } from "@/features/tasks/server/queries";
import { addDays, type DayKey, formatDayKey } from "@/lib/time/calendar-day";
import { formatCompact } from "@/lib/time/elapsed";

function dayHeading(key: DayKey, todayKey: DayKey): string {
  const date = formatDayKey(key, { weekday: "long", day: "numeric", month: "long" });
  if (key === todayKey) return `Today · ${date}`;
  if (key === addDays(todayKey, 1)) return `Tomorrow · ${date}`;
  return date;
}

export function AgendaList({
  data,
  onEdit,
  onCreate,
  onDelete,
}: { data: CalendarData; onDelete: (task: TaskWithTrack) => void } & GridHandlers) {
  const { range, tasksByDay, focusByDay, todayKey, now, timeZone } = data;

  // Only days with something on them; four weeks of empty headings is noise.
  const days = range.days.filter((key) => tasksByDay[key]?.length || focusByDay?.[key]);

  if (days.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing due in these four weeks"
        description="Tasks with a deadline in this stretch show up here, day by day."
        action={
          <Button className="cursor-pointer gap-2" onClick={() => onCreate(range.start)}>
            <Plus className="size-4" aria-hidden />
            Add a task
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {days.map((key) => {
        const tasks = tasksByDay[key] ?? [];
        const focusMs = focusByDay?.[key];

        return (
          <section key={key} aria-labelledby={`agenda-${key}`}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3
                id={`agenda-${key}`}
                className={key === todayKey ? "text-primary text-sm font-medium" : "text-sm font-medium"}
              >
                {dayHeading(key, todayKey)}
              </h3>
              {focusMs ? (
                <span className="text-primary tabular flex items-center gap-1 text-xs">
                  <Timer className="size-3" aria-hidden />
                  {formatCompact(focusMs)} focused
                </span>
              ) : null}
            </div>
            {tasks.length > 0 ? (
              <ul className="bg-card divide-y overflow-hidden rounded-xl border">
                <AnimatePresence initial={false}>
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      now={now}
                      timeZone={timeZone}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">No deadlines.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
