"use client";

import { AnimatePresence } from "motion/react";
import { ChevronDown, ListTodo, Plus, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteTaskDialog } from "@/features/tasks/components/delete-task-dialog";
import { TaskFormDialog, type TaskFormDefaults } from "@/features/tasks/components/task-form-dialog";
import { TaskRow } from "@/features/tasks/components/task-row";
import type { OpenBucket } from "@/features/tasks/lib/due";
import { createTask } from "@/features/tasks/server/actions";
import type { TaskBoard as Board, TaskWithTrack } from "@/features/tasks/server/queries";
import type { TrackOption } from "@/features/tracks/server/queries";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

const ALL_TRACKS = "all";

const SECTIONS: {
  bucket: OpenBucket;
  title: string;
  /** Shown when the section is empty; omit to hide the section instead. */
  emptyText?: string;
  className?: string;
}[] = [
  { bucket: "overdue", title: "Overdue", className: "text-destructive" },
  { bucket: "today", title: "Today", emptyText: "Nothing due today." },
  { bucket: "upcoming", title: "Upcoming" },
  { bucket: "someday", title: "Someday" },
];

type FormState = {
  open: boolean;
  /** Bumped on every open so the form remounts with fresh fields. */
  generation: number;
  task?: TaskWithTrack;
  defaults?: TaskFormDefaults;
};

export function TaskBoard({
  board,
  tracks,
  trackFilter,
  weekStartsOn,
}: {
  board: Board;
  tracks: TrackOption[];
  /** `"none"`, a track id, or undefined for every task. */
  trackFilter: string | undefined;
  weekStartsOn: 0 | 1;
}) {
  const router = useRouter();
  const [filtering, startFiltering] = useTransition();
  const [form, setForm] = useState<FormState>({ open: false, generation: 0 });
  const [deleting, setDeleting] = useState<TaskWithTrack | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  // A filtered track is the natural home for anything added while viewing it.
  const filterTrackId = trackFilter && trackFilter !== "none" ? trackFilter : null;

  const openCount = Object.values(board.open).reduce((n, list) => n + list.length, 0);
  const isEmpty = openCount === 0 && board.closed.length === 0;

  function setFilter(value: string) {
    const query = value === ALL_TRACKS ? "" : `?track=${encodeURIComponent(value)}`;
    startFiltering(() => router.replace(`/tasks${query}`, { scroll: false }));
  }

  function openCreate(defaults?: TaskFormDefaults) {
    setForm((f) => ({
      open: true,
      generation: f.generation + 1,
      defaults: { trackId: filterTrackId, ...defaults },
    }));
  }

  function openEdit(task: TaskWithTrack) {
    setForm((f) => ({ open: true, generation: f.generation + 1, task }));
  }

  const rowProps = {
    now: board.now,
    timeZone: board.timeZone,
    onEdit: openEdit,
    onDelete: setDeleting,
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <QuickAdd
          trackId={filterTrackId}
          onMoreOptions={(title) => openCreate({ title })}
        />

        <Select value={trackFilter ?? ALL_TRACKS} onValueChange={setFilter}>
          <SelectTrigger
            aria-label="Filter by track"
            className="w-full cursor-pointer sm:w-48"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value={ALL_TRACKS} className="cursor-pointer">
              All tracks
            </SelectItem>
            <SelectItem value="none" className="cursor-pointer">
              No track
            </SelectItem>
            {tracks.length > 0 ? <SelectSeparator /> : null}
            {tracks.map((track) => (
              <SelectItem key={track.id} value={track.id} className="cursor-pointer">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", trackColorClasses(track.color).bg)}
                />
                {track.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn("mt-6 space-y-8 transition-opacity", filtering && "opacity-60")}
        aria-busy={filtering}
      >
        {isEmpty ? (
          <EmptyState
            icon={ListTodo}
            title={trackFilter ? "No tasks here yet" : "No tasks yet"}
            description={
              trackFilter
                ? "Nothing is filed under this filter. Add one above, or switch back to all tracks."
                : "Type a task above and press Enter. Give it a deadline and it lands under Today or Upcoming; leave it open-ended and it waits under Someday."
            }
          />
        ) : (
          <>
            {SECTIONS.map(({ bucket, title, emptyText, className }) => {
              const list = board.open[bucket];
              if (list.length === 0 && !emptyText) return null;

              return (
                <section key={bucket} aria-labelledby={`tasks-${bucket}`}>
                  <SectionHeading id={`tasks-${bucket}`} count={list.length} className={className}>
                    {title}
                  </SectionHeading>
                  {list.length === 0 ? (
                    <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-3 text-sm">
                      {emptyText}
                    </p>
                  ) : (
                    <ul className="bg-card divide-y overflow-hidden rounded-xl border">
                      <AnimatePresence initial={false}>
                        {list.map((task) => (
                          <TaskRow key={task.id} task={task} {...rowProps} />
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </section>
              );
            })}

            {board.closed.length > 0 ? (
              <section aria-labelledby="tasks-closed">
                <h2 id="tasks-closed" className="mb-2">
                  <button
                    type="button"
                    onClick={() => setShowClosed((v) => !v)}
                    aria-expanded={showClosed}
                    aria-controls="tasks-closed-list"
                    className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-sm font-medium transition-colors"
                  >
                    <ChevronDown
                      className={cn("size-4 transition-transform", !showClosed && "-rotate-90")}
                      aria-hidden
                    />
                    Done
                    <span className="font-numeric font-normal">{board.closed.length}</span>
                  </button>
                </h2>
                {showClosed ? (
                  <ul
                    id="tasks-closed-list"
                    className="bg-card divide-y overflow-hidden rounded-xl border"
                  >
                    <AnimatePresence initial={false}>
                      {board.closed.map((task) => (
                        <TaskRow key={task.id} task={task} {...rowProps} />
                      ))}
                    </AnimatePresence>
                  </ul>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </div>

      <TaskFormDialog
        // Remount per opening so fields reset instead of carrying values over.
        key={form.generation}
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        task={form.task}
        defaults={form.defaults}
        tracks={tracks}
        timeZone={board.timeZone}
        todayKey={board.todayKey}
        weekStartsOn={weekStartsOn}
      />

      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

function SectionHeading({
  id,
  count,
  className,
  children,
}: {
  id: string;
  count: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className={cn("mb-2 flex items-baseline gap-2 text-sm font-medium", className)}>
      {children}
      <span className="text-muted-foreground font-numeric font-normal">{count}</span>
    </h2>
  );
}

/**
 * Title and Enter, nothing else. Capturing a task has to be faster than
 * deciding not to bother; deadlines and priority can wait for the full form.
 */
function QuickAdd({
  trackId,
  onMoreOptions,
}: {
  trackId: string | null;
  onMoreOptions: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await createTask({ title: trimmed, trackId });
      if (result.ok) setTitle("");
      else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-1 gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task and press Enter"
        aria-label="New task title"
        maxLength={200}
        className="flex-1"
      />
      <Button
        type="submit"
        className="cursor-pointer gap-1.5"
        disabled={!title.trim() || pending}
        aria-busy={pending}
      >
        <Plus className="size-4" aria-hidden />
        Add
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="cursor-pointer"
        aria-label="Add with deadline and details"
        onClick={() => {
          onMoreOptions(title.trim());
          setTitle("");
        }}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
