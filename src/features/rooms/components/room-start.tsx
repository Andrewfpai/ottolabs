"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Track } from "@/db/schema";
import { roomQueryKey } from "@/features/rooms/components/room-live";
import { useActiveSession, useStartSession } from "@/features/sessions/hooks/use-active-session";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

/**
 * Start a timer that counts toward this room. Your own timer and tracks, as
 * anywhere else; the only difference is the room tag on the session.
 */
export function RoomStart({ roomId, tracks }: { roomId: string; tracks: Track[] }) {
  const queryClient = useQueryClient();
  const { data: active } = useActiveSession();
  const start = useStartSession();
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");

  if (active) {
    const here = active.roomId === roomId;
    return (
      <div className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
        {here ? (
          <>
            Your timer on <span className="text-foreground font-medium">{active.track.title}</span> is
            running here. Pause and finish it from the timer bar.
          </>
        ) : (
          <>
            Your timer on <span className="text-foreground font-medium">{active.track.title}</span> was
            started outside this room, so it does not count here. Finish it, then start one from here.
          </>
        )}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
        Create a track on the{" "}
        <Link href="/tracks" className="text-foreground underline underline-offset-4">
          Tracks page
        </Link>{" "}
        to start focusing in this room.
      </div>
    );
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
      <span className="text-sm font-medium sm:mr-auto">Focus in this room</span>
      <Select value={trackId} onValueChange={setTrackId}>
        <SelectTrigger aria-label="Track" className="w-full cursor-pointer sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
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
      <Button
        variant="cta"
        className="cursor-pointer gap-1.5"
        disabled={!trackId || start.isPending}
        aria-busy={start.isPending}
        onClick={() =>
          start.mutate(
            { trackId, mode: "stopwatch", roomId },
            // Show yourself as focusing now rather than at the next poll.
            { onSuccess: () => void queryClient.invalidateQueries({ queryKey: roomQueryKey(roomId) }) },
          )
        }
      >
        <Play className="size-4" aria-hidden />
        Start
      </Button>
    </div>
  );
}
