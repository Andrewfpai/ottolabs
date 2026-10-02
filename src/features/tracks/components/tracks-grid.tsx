"use client";

import { AnimatePresence } from "motion/react";
import { Layers, Plus } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { useActiveSession } from "@/features/sessions/hooks/use-active-session";
import type { TrackTask } from "@/features/tasks/server/queries";
import { TrackCard } from "@/features/tracks/components/track-card";
import { TrackFormDialog } from "@/features/tracks/components/track-form-dialog";
import type { TrackWithStats } from "@/features/tracks/server/queries";
import { suggestTrackColor } from "@/lib/track-colors";

export function TracksGrid({
  tracks,
  tasks = {},
}: {
  tracks: TrackWithStats[];
  /** Open tasks per track id. */
  tasks?: Record<string, TrackTask[]>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrackWithStats | undefined>();

  // Disables every Start button while something is already running, rather than
  // letting you click one and get a 409 back from the unique index.
  const { data: active } = useActiveSession();

  const visible = tracks.filter((t) => t.status !== "archived");
  const archived = tracks.filter((t) => t.status === "archived");

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(track: TrackWithStats) {
    setEditing(track);
    setFormOpen(true);
  }

  if (tracks.length === 0) {
    return (
      <>
        <EmptyState
          icon={Layers}
          title="No tracks yet"
          description="A track is a topic you want to put hours into, like Databases or Cybersecurity. Create one, then start a timer against it."
          action={
            <Button className="cursor-pointer gap-2" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              New track
            </Button>
          }
        />
        <TrackFormDialog
          key="create-empty"
          open={formOpen}
          onOpenChange={setFormOpen}
          suggestedColor={suggestTrackColor([])}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button className="cursor-pointer gap-2" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New track
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {visible.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              tasks={tasks[track.id] ?? []}
              onEdit={openEdit}
              hasActiveSession={Boolean(active)}
            />
          ))}
        </AnimatePresence>
      </div>

      {archived.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">
            Archived
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                tasks={tasks[track.id] ?? []}
                onEdit={openEdit}
                hasActiveSession={Boolean(active)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <TrackFormDialog
        // Remounts on target change so the fields reset to the right values
        // instead of carrying over whatever was last typed.
        key={editing?.id ?? "create"}
        open={formOpen}
        onOpenChange={setFormOpen}
        track={editing}
        suggestedColor={suggestTrackColor(tracks.map((t) => t.color))}
      />
    </>
  );
}
