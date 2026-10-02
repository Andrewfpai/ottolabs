"use client";

import { AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DeleteTaskDialog } from "@/features/tasks/components/delete-task-dialog";
import { TaskFormDialog, type TaskFormDefaults } from "@/features/tasks/components/task-form-dialog";
import { TaskRow } from "@/features/tasks/components/task-row";
import type { TaskWithTrack } from "@/features/tasks/server/queries";
import type { TrackOption } from "@/features/tracks/server/queries";
import type { DayKey } from "@/lib/time/calendar-day";

type Section = { id: string; title: string; tasks: TaskWithTrack[]; emptyText: string; more?: number };

type FormState = {
  open: boolean;
  generation: number;
  task?: TaskWithTrack;
  defaults?: TaskFormDefaults;
};

/** Today's tasks and what is coming up, with the same rows and dialogs as /tasks. */
export function DashboardTasks({
  sections,
  tracks,
  now,
  timeZone,
  todayKey,
  weekStartsOn,
}: {
  sections: Section[];
  tracks: TrackOption[];
  now: number;
  timeZone: string;
  todayKey: DayKey;
  weekStartsOn: 0 | 1;
}) {
  const [form, setForm] = useState<FormState>({ open: false, generation: 0 });
  const [deleting, setDeleting] = useState<TaskWithTrack | null>(null);

  const onEdit = (task: TaskWithTrack) =>
    setForm((f) => ({ open: true, generation: f.generation + 1, task }));

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <section
            key={section.id}
            aria-labelledby={`dash-${section.id}`}
            className="bg-card min-w-0 rounded-xl border"
          >
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h2 id={`dash-${section.id}`} className="text-sm font-medium">
                {section.title}{" "}
                <span className="text-muted-foreground font-normal">{section.tasks.length + (section.more ?? 0)}</span>
              </h2>
              {section.id === "today" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer gap-1.5"
                  onClick={() =>
                    setForm((f) => ({
                      open: true,
                      generation: f.generation + 1,
                      defaults: { dueDate: todayKey },
                    }))
                  }
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add for today
                </Button>
              ) : (
                <Link href="/calendar?view=agenda" className="text-muted-foreground hover:text-foreground text-xs">
                  Open agenda
                </Link>
              )}
            </div>

            {section.tasks.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">{section.emptyText}</p>
            ) : (
              <ul className="divide-y">
                <AnimatePresence initial={false}>
                  {section.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      now={now}
                      timeZone={timeZone}
                      onEdit={onEdit}
                      onDelete={setDeleting}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}

            {section.more ? (
              <div className="border-t px-4 py-2.5">
                <Link href="/tasks" className="text-muted-foreground hover:text-foreground text-xs">
                  {section.more} more on the Tasks page
                </Link>
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <TaskFormDialog
        key={form.generation}
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        task={form.task}
        defaults={form.defaults}
        tracks={tracks}
        timeZone={timeZone}
        todayKey={todayKey}
        weekStartsOn={weekStartsOn}
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
