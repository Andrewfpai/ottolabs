"use client";

import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { Flame, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { PersonAvatar } from "@/features/friends/components/person-avatar";
import type { FriendCard } from "@/features/friends/server/queries";
import { focusInRoom, joinRoom, studyWith } from "@/features/rooms/server/actions";
import type { RoomInvitation } from "@/features/rooms/server/queries";
import { ACTIVE_SESSION_KEY } from "@/features/sessions/hooks/use-active-session";
import { now as clockNow } from "@/lib/time/clock";
import { elapsedMs, formatCompact } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

/** How often the panel asks the server who is studying, while it is open. */
const REFRESH_MS = 60_000;

/**
 * Who is studying right now, how long everyone has focused today, and a
 * one-tap "study together" for each friend. Invitations from friends wait
 * at the top with a Join button.
 */
export function FriendsPanel({
  friends,
  invitations,
  running,
  onClose,
}: {
  friends: FriendCard[];
  invitations: RoomInvitation[];
  /** Whether you have a timer to bring into a room. */
  running: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => clockNow());

  // Live minutes tick, and the list itself refreshes now and then.
  useEffect(() => {
    const tick = setInterval(() => setNow(clockNow()), 30_000);
    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  const sorted = [...friends].sort(
    (a, b) => Number(Boolean(b.live)) - Number(Boolean(a.live)) || b.todayMs - a.todayMs,
  );
  const studying = friends.filter((f) => f.live).length;

  function afterRoomChange() {
    void queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
    router.refresh();
  }

  function invite(friend: FriendCard) {
    startTransition(async () => {
      const result = await studyWith({ friendId: friend.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.already
          ? `${friend.name} is already in your room.`
          : `Invited ${friend.name}.${running ? " Your timer is in your room now." : ""}`,
      );
      afterRoomChange();
    });
  }

  function accept(invitation: RoomInvitation) {
    startTransition(async () => {
      const joined = await joinRoom({ roomId: invitation.roomId });
      if (!joined.ok) {
        toast.error(joined.error);
        return;
      }
      if (running) {
        const moved = await focusInRoom({ roomId: invitation.roomId });
        if (!moved.ok) toast.error(moved.error);
      }
      toast.success(`Joined ${invitation.roomName}.`);
      afterRoomChange();
    });
  }

  return (
    <motion.section
      aria-label="Friends"
      initial={reduceMotion ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      // Placed by focus mode's left column, with the room panel.
      className="flex min-h-0 flex-col rounded-2xl border border-white/15 bg-black/55 text-white shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div>
          <h2 className="text-sm font-medium">Friends</h2>
          <p className="text-xs text-white/60">
            {studying > 0 ? `${studying} studying now` : "Nobody is studying right now"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close friends"
          className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto px-1.5 pb-2">
        {invitations.map((invitation) => (
          <div key={invitation.roomId} className="mx-1.5 mb-2 flex items-center gap-2.5 rounded-xl bg-white/10 p-2">
            <PersonAvatar name={invitation.from} image={invitation.image} className="size-8" />
            <p className="min-w-0 flex-1 text-xs">
              <span className="font-medium">{invitation.from}</span> wants to study together
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => accept(invitation)}
              className="cursor-pointer rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-black hover:bg-white/90 disabled:opacity-50"
            >
              Join
            </button>
          </div>
        ))}

        {sorted.length === 0 ? (
          <p className="px-2 py-3 text-xs text-white/70">
            No friends yet.{" "}
            <Link href="/friends" className="underline underline-offset-4">
              Add some
            </Link>{" "}
            to see them here.
          </p>
        ) : (
          <ul>
            {sorted.map((friend) => {
              const live = friend.live;
              const liveMs = live
                ? elapsedMs({ startedAt: live.startedAt, endedAt: null, pausedMs: live.pausedMs, pausedAt: live.pausedAt }, now)
                : 0;
              return (
                <li key={friend.id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-white/5">
                  <span className="relative shrink-0">
                    <PersonAvatar name={friend.name} image={friend.image} className="size-9" />
                    {live ? (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-black/60",
                          live.pausedAt ? "bg-amber-400" : "bg-emerald-400",
                        )}
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{friend.name}</p>
                    {live ? (
                      <p className="flex min-w-0 items-center gap-1.5 text-xs text-white/80">
                        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", trackColorClasses(live.trackColor).bg)} />
                        <span className="truncate">
                          {live.pausedAt ? "Paused" : "Studying"} {live.trackLabel}
                        </span>
                        <span className="tabular shrink-0 text-white/60">{formatCompact(liveMs)}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-white/60">
                        <span className="tabular">{formatCompact(friend.todayMs)}</span> today
                        {friend.streak > 1 ? (
                          <span className="ml-2 inline-flex items-center gap-0.5">
                            <Flame className="size-3" aria-hidden />
                            {friend.streak}
                          </span>
                        ) : null}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => invite(friend)}
                    aria-label={`Study together with ${friend.name}`}
                    title="Study together"
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-50"
                  >
                    <UserPlus className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.section>
  );
}
