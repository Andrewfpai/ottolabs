"use client";

import { Pencil, Play, Timer } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Track } from "@/db/schema";
import { useActiveSession, useStartSession } from "@/features/sessions/hooks/use-active-session";
import { TrackFormDialog } from "@/features/tracks/components/track-form-dialog";

/** Start (the one orange button), a Pomodoro start, and Edit. */
export function TrackActions({ track }: { track: Track }) {
  const start = useStartSession();
  const { data: active } = useActiveSession();
  const [editing, setEditing] = useState(false);
  const [generation, setGeneration] = useState(0);

  const archived = track.status === "archived";
  const blocked = Boolean(active) || start.isPending;

  return (
    <div className="flex flex-wrap gap-2">
      {!archived ? (
        <>
          <Button
            variant="cta"
            className="cursor-pointer gap-1.5"
            disabled={blocked}
            aria-busy={start.isPending}
            title={active ? "Finish the running timer first" : undefined}
            onClick={() => start.mutate({ trackId: track.id, mode: "stopwatch" })}
          >
            <Play className="size-3.5 fill-current" aria-hidden />
            Start
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer gap-1.5"
            disabled={blocked}
            onClick={() => start.mutate({ trackId: track.id, mode: "pomodoro" })}
          >
            <Timer className="size-4" aria-hidden />
            Pomodoro
          </Button>
        </>
      ) : null}
      <Button
        variant="outline"
        className="cursor-pointer gap-1.5"
        onClick={() => {
          setGeneration((g) => g + 1);
          setEditing(true);
        }}
      >
        <Pencil className="size-3.5" aria-hidden />
        Edit
      </Button>
      <TrackFormDialog key={generation} open={editing} onOpenChange={setEditing} track={track} />
    </div>
  );
}
