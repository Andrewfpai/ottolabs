"use client";

import { useQuery } from "@tanstack/react-query";
import { Coffee, Crown, DoorOpen, Pause, Timer, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { PersonAvatar } from "@/features/friends/components/person-avatar";
import { type MemberState, ROOM_POLL_MS } from "@/features/rooms/lib/room";
import type { RoomLive as RoomLiveData, RoomMemberLive } from "@/features/rooms/server/queries";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { now as clockNow } from "@/lib/time/clock";
import { elapsedMs, formatCompact } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

export const roomQueryKey = (roomId: string) => ["room", roomId] as const;

class LeftRoomError extends Error {}

async function fetchRoom(roomId: string): Promise<RoomLiveData> {
  const res = await fetch(`/api/rooms/${roomId}/live`, { cache: "no-store" });
  if (res.status === 404) throw new LeftRoomError("You are no longer in this room.");
  if (!res.ok) throw new Error(`Could not refresh the room (${res.status})`);
  return res.json();
}

/** State always comes with a word and an icon, never colour alone. */
const STATE_META: Record<MemberState, { label: string; icon: typeof Timer; className: string }> = {
  focusing: { label: "Focusing", icon: Timer, className: "bg-primary/10 text-primary" },
  break: { label: "On a break", icon: Coffee, className: "bg-muted text-foreground" },
  paused: { label: "Paused", icon: Pause, className: "bg-muted text-foreground" },
  away: { label: "Away", icon: DoorOpen, className: "text-muted-foreground" },
};

const STATE_ORDER: Record<MemberState, number> = { focusing: 0, break: 1, paused: 2, away: 3 };

/** Repaints every 15s; minutes are recomputed from timestamps, so no drift. */
function useRepaint(active: boolean, ms = 15_000) {
  const [, repaint] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => repaint((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}

function MemberRow({ member }: { member: RoomMemberLive }) {
  const hydrated = useIsHydrated();
  const meta = STATE_META[member.state];
  const Icon = meta.icon;
  useRepaint(member.state === "focusing");

  const minutes =
    hydrated && member.session ? formatCompact(elapsedMs(member.session, clockNow())) : null;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <PersonAvatar
        name={member.name}
        image={member.image}
        className={cn(member.state === "away" && "opacity-60")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium">{member.name}</span>
          {member.isSelf ? (
            <Badge variant="secondary" className="text-xs">
              You
            </Badge>
          ) : null}
          {member.isOwner ? (
            <Crown className="text-muted-foreground size-3.5" aria-label="Owner" />
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", meta.className)}>
            <Icon className="size-3" aria-hidden />
            {meta.label}
          </span>
          {member.session ? (
            <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-1.5 shrink-0 rounded-full", trackColorClasses(member.session.trackColor).bg)}
              />
              <span className="truncate">{member.session.trackLabel}</span>
              {minutes ? <span className="font-numeric text-foreground">{minutes}</span> : null}
              {member.inThisRoom ? <span>· here</span> : null}
            </span>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <div className="tabular text-sm font-medium">{formatCompact(member.weekMs)}</div>
        <div className="text-muted-foreground text-xs">this week here</div>
      </div>
    </li>
  );
}

export function RoomLive({ roomId, initial }: { roomId: string; initial: RoomLiveData }) {
  const { data, error } = useQuery({
    queryKey: roomQueryKey(roomId),
    queryFn: () => fetchRoom(roomId),
    initialData: initial,
    refetchInterval: ROOM_POLL_MS,
    // A room in a background tab does not need updating; it catches up on focus.
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: (failures, err) => !(err instanceof LeftRoomError) && failures < 2,
  });

  if (error instanceof LeftRoomError) {
    return (
      <div className="bg-card rounded-xl border p-6 text-center">
        <p className="text-sm font-medium">You are no longer in this room.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          It was deleted, or the owner removed you.{" "}
          <Link href="/rooms" className="text-foreground underline underline-offset-4">
            Back to rooms
          </Link>
        </p>
      </div>
    );
  }

  const members = [...data.members].sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name),
  );
  const focusing = members.filter((m) => m.state === "focusing").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-card min-w-0 rounded-xl border p-3 sm:p-4">
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Users className="size-3.5" aria-hidden />
            Focusing now
          </div>
          <div className="font-numeric mt-1 text-lg font-semibold whitespace-nowrap sm:text-2xl">
            {focusing}
            <span className="text-muted-foreground text-base font-normal">/{members.length}</span>
          </div>
        </div>
        <div className="bg-card min-w-0 rounded-xl border p-3 sm:p-4">
          <div className="text-muted-foreground text-xs">Together today</div>
          <div className="font-numeric mt-1 text-lg font-semibold whitespace-nowrap sm:text-2xl">{formatCompact(data.todayMs)}</div>
        </div>
        <div className="bg-card min-w-0 rounded-xl border p-3 sm:p-4">
          <div className="text-muted-foreground text-xs">This week</div>
          <div className="font-numeric mt-1 text-lg font-semibold whitespace-nowrap sm:text-2xl">{formatCompact(data.weekMs)}</div>
        </div>
      </div>

      <section aria-label="Members" className="bg-card rounded-xl border">
        <ul className="divide-y">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </ul>
        <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
          Updates every few seconds. Time counts toward the room when a session is started from here.
        </p>
      </section>
    </div>
  );
}
