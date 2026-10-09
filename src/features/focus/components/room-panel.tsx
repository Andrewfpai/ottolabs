"use client";

import { motion, useReducedMotion } from "motion/react";
import { DoorOpen, X } from "lucide-react";
import Link from "next/link";

import {
  LeftRoomError,
  Leaderboard,
  PresenceAvatar,
  Reactions,
  useRoomLive,
} from "@/features/rooms/components/room-live";

/**
 * The room you are studying in, over focus mode: who is here and what they
 * are doing, the day's leaderboard, and reactions to send. What makes a
 * shared session feel shared while you are heads-down.
 */
export function RoomPanel({ roomId, roomName, onClose }: { roomId: string; roomName: string; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const { data: live, error } = useRoomLive(roomId);
  // Removed by the owner, or the room was deleted: stop showing it as if nothing happened.
  const removed = error instanceof LeftRoomError;
  const data = removed ? undefined : live;

  const focusing = data?.members.filter((m) => m.state === "focusing").length ?? 0;
  const self = data?.members.find((m) => m.isSelf);
  const viewerId = self?.id;

  return (
    <motion.section
      aria-label={`Room: ${roomName}`}
      initial={reduceMotion ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex min-h-0 flex-col rounded-2xl border border-white/15 bg-black/55 text-white shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0">
          <Link href={`/rooms/${roomId}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
            <DoorOpen className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{roomName}</span>
          </Link>
          <p className="text-xs text-white/60">
            {removed
              ? "You are no longer in this room."
              : data
                ? `${focusing} of ${data.members.length} focusing now`
                : "Joining the room…"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the room panel"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {data ? (
        <div className="min-h-0 space-y-3 overflow-y-auto px-3 pb-3">
          <div className="flex -space-x-1">
            {data.members.slice(0, 10).map((m) => (
              <PresenceAvatar key={m.id} member={m} className="size-7 ring-offset-black/0" />
            ))}
          </div>
          {/* Owners can remove people right here, without leaving focus mode. */}
          <Leaderboard members={data.members} asOf={data.asOf} compact kickFrom={self?.isOwner ? roomId : undefined} />
          <Reactions roomId={roomId} reactions={data.reactions} asOf={data.asOf} viewerId={viewerId} compact />
        </div>
      ) : null}
    </motion.section>
  );
}
