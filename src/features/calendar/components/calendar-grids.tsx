"use client";

import { Plus, Timer } from "lucide-react";
import Link from "next/link";

import { calendarHref } from "@/features/calendar/lib/range";
import type { CalendarData } from "@/features/calendar/server/queries";
import { isOpen } from "@/features/tasks/lib/due";
import type { TaskWithTrack } from "@/features/tasks/server/queries";
import { type DayKey, dayKey, formatDayKey, parseDayKey, timeOfDay } from "@/lib/time/calendar-day";
import { formatCompact } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

/** How many tasks a month cell lists before collapsing the rest into "+N more". */
const MONTH_CELL_LIMIT = 3;

export type GridHandlers = {
  onEdit: (task: TaskWithTrack) => void;
  onCreate: (day: DayKey) => void;
};

function longDay(key: DayKey): string {
  return formatDayKey(key, { weekday: "long", day: "numeric", month: "long" });
}

function isLate(task: TaskWithTrack, now: number, timeZone: string): boolean {
  if (!isOpen(task.status) || !task.dueAt) return false;
  // An all-day deadline is only missed once its day is over.
  return task.isAllDay
    ? dayKey(task.dueAt, timeZone) < dayKey(now, timeZone)
    : task.dueAt.getTime() < now;
}

function trackDot(task: TaskWithTrack): string {
  return task.track ? trackColorClasses(task.track.color).bg : "bg-muted-foreground/50";
}

function TaskChip({
  task,
  now,
  timeZone,
  onEdit,
}: {
  task: TaskWithTrack;
  now: number;
  timeZone: string;
  onEdit: (task: TaskWithTrack) => void;
}) {
  const done = task.status === "done";
  const late = isLate(task, now, timeZone);
  const time = task.dueAt && !task.isAllDay ? timeOfDay(task.dueAt, timeZone) : null;

  return (
    <button
      type="button"
      onClick={() => onEdit(task)}
      title={task.title}
      className={cn(
        "hover:bg-muted flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-xs transition-colors",
        done && "text-muted-foreground line-through",
        late && "text-destructive",
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", trackDot(task))} />
      {time ? <span className="tabular text-muted-foreground shrink-0">{time}</span> : null}
      <span className="truncate">{task.title}</span>
      {done ? <span className="sr-only">, done</span> : null}
      {late ? <span className="sr-only">, overdue</span> : null}
    </button>
  );
}

function AddButton({ day, onCreate, className }: { day: DayKey; onCreate: (day: DayKey) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onCreate(day)}
      aria-label={`Add a task due ${longDay(day)}`}
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors",
        className,
      )}
    >
      <Plus className="size-3.5" aria-hidden />
    </button>
  );
}

function FocusLabel({ ms, className }: { ms: number; className?: string }) {
  return (
    <span
      className={cn(
        "tabular flex items-center gap-1 text-xs",
        ms > 0 ? "text-primary" : "text-muted-foreground",
        className,
      )}
    >
      <Timer className="size-3" aria-hidden />
      {formatCompact(ms)}
      <span className="sr-only"> focused</span>
    </span>
  );
}

export function MonthGrid({ data, onEdit, onCreate }: { data: CalendarData } & GridHandlers) {
  const { range, tasksByDay, focusByDay, todayKey, now, timeZone } = data;
  // "2026-10": days from the neighbouring months are padding and get dimmed.
  const month = range.anchor.slice(0, 7);
  const weekdays = range.days.slice(0, 7).map((key) => formatDayKey(key, { weekday: "short" }));

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="bg-muted/40 grid grid-cols-7 border-b" aria-hidden>
        {weekdays.map((name) => (
          <div key={name} className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
            <span className="sm:hidden">{name.slice(0, 1)}</span>
            <span className="max-sm:hidden">{name}</span>
          </div>
        ))}
      </div>

      {/* Negative margins tuck the outer cell borders under the container's own. */}
      <ul className="-mr-px -mb-px grid grid-cols-7">
        {range.days.map((key) => {
          const tasks = tasksByDay[key] ?? [];
          const focusMs = focusByDay?.[key];
          const outside = key.slice(0, 7) !== month;
          const isToday = key === todayKey;
          const hidden = tasks.length - MONTH_CELL_LIMIT;

          return (
            <li
              key={key}
              aria-label={`${longDay(key)}${tasks.length ? `, ${tasks.length} due` : ""}`}
              className={cn(
                "group/cell relative flex min-h-16 flex-col gap-1 border-r border-b p-1 sm:min-h-28 sm:p-1.5",
                outside && "bg-muted/25",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "tabular flex size-6 items-center justify-center rounded-full text-xs",
                    isToday && "bg-primary text-primary-foreground font-semibold",
                    outside && !isToday && "text-muted-foreground/60",
                  )}
                >
                  {parseDayKey(key).day}
                </span>
                <AddButton
                  day={key}
                  onCreate={onCreate}
                  className="opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100 max-sm:hidden"
                />
              </div>

              {/* Full chips where there is room for them … */}
              <div className="flex min-w-0 flex-col gap-0.5 max-sm:hidden">
                {tasks.slice(0, MONTH_CELL_LIMIT).map((task) => (
                  <TaskChip key={task.id} task={task} now={now} timeZone={timeZone} onEdit={onEdit} />
                ))}
                {hidden > 0 ? (
                  <Link
                    href={calendarHref("week", key, focusByDay !== null)}
                    className="text-muted-foreground hover:text-foreground px-1.5 text-xs"
                  >
                    +{hidden} more
                  </Link>
                ) : null}
              </div>

              {/* … and dots on a phone, where the whole cell opens that week. */}
              {tasks.length > 0 ? (
                <div className="flex flex-wrap gap-0.5 px-1 sm:hidden" aria-hidden>
                  {tasks.slice(0, 6).map((task) => (
                    <span
                      key={task.id}
                      className={cn(
                        "size-1.5 rounded-full",
                        isLate(task, now, timeZone) ? "bg-destructive" : trackDot(task),
                        task.status === "done" && "opacity-40",
                      )}
                    />
                  ))}
                </div>
              ) : null}
              <Link
                href={calendarHref("week", key, focusByDay !== null)}
                className="absolute inset-0 sm:hidden"
                aria-label={`Open the week of ${longDay(key)}`}
              />

              {focusMs ? (
                // No icon on a phone: a 50px cell cannot fit it and "1h 30m".
                <FocusLabel ms={focusMs} className="mt-auto max-sm:text-[10px] max-sm:[&>svg]:hidden" />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WeekGrid({ data, onEdit, onCreate }: { data: CalendarData } & GridHandlers) {
  const { range, tasksByDay, focusByDay, todayKey, now, timeZone } = data;

  return (
    <div className="grid gap-2 lg:grid-cols-7">
      {range.days.map((key) => {
        const tasks = tasksByDay[key] ?? [];
        const isToday = key === todayKey;

        return (
          <section
            key={key}
            aria-label={longDay(key)}
            className={cn(
              "bg-card flex flex-col rounded-xl border p-2 lg:min-h-72",
              isToday && "border-primary/60",
            )}
          >
            <header className="mb-1.5 flex items-center justify-between gap-2 px-1">
              <span className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground text-xs">
                  {formatDayKey(key, { weekday: "short" })}
                </span>
                <span className={cn("tabular text-lg font-semibold", isToday && "text-primary")}>
                  {parseDayKey(key).day}
                </span>
              </span>
              <AddButton day={key} onCreate={onCreate} />
            </header>

            {focusByDay ? <FocusLabel ms={focusByDay[key] ?? 0} className="mb-1.5 px-1" /> : null}

            {tasks.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                {tasks.map((task) => (
                  <TaskChip key={task.id} task={task} now={now} timeZone={timeZone} onEdit={onEdit} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground px-1 text-xs">No deadlines</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
