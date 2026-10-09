"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Coffee, Crown, DoorOpen, Pause, Timer, UserMinus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/features/friends/components/person-avatar";
import {
  agoLabel,
  type MemberState,
  REACTION_EMOJI,
  ROOM_POLL_MS,
  ROOM_REACTIONS,
  type RoomReaction,
} from "@/features/rooms/lib/room";
import { removeMember, sendRoomReaction } from "@/features/rooms/server/actions";
import type { RoomLive as RoomLiveData, RoomMemberLive } from "@/features/rooms/server/queries";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { now as clockNow } from "@/lib/time/clock";
import { elapsedMs, formatCompact } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

export const roomQueryKey = (roomId: string) => ["room", roomId] as const;

export class LeftRoomError extends Error {}

async function fetchRoom(roomId: string): Promise<RoomLiveData> {
  const res = await fetch(`/api/rooms/${roomId}/live`, { cache: "no-store" });
  if (res.status === 404) throw new LeftRoomError("You are no longer in this room.");
  if (!res.ok) throw new Error(`Could not refresh the room (${res.status})`);
  return res.json();
}

/** The room, polled while visible. Shared by the room page and focus mode. */
export function useRoomLive(roomId: string, initial?: RoomLiveData) {
  return useQuery({
    queryKey: roomQueryKey(roomId),
    queryFn: () => fetchRoom(roomId),
    initialData: initial,
    refetchInterval: ROOM_POLL_MS,
    // A room in a background tab does not need updating; it catches up on focus.
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: (failures, err) => !(err instanceof LeftRoomError) && failures < 2,
  });
}

/** State always comes with a word and an icon, never colour alone. */
export const STATE_META: Record<MemberState, { label: string; icon: typeof Timer; dot: string; ring: string }> = {
  focusing: { label: "Focusing", icon: Timer, dot: "bg-emerald-500", ring: "ring-emerald-500" },
  break: { label: "On a break", icon: Coffee, dot: "bg-amber-400", ring: "ring-amber-400" },
  paused: { label: "Paused", icon: Pause, dot: "bg-amber-400", ring: "ring-amber-400" },
  away: { label: "Away", icon: DoorOpen, dot: "bg-muted-foreground/50", ring: "ring-transparent" },
};

const STATE_ORDER: Record<MemberState, number> = { focusing: 0, break: 1, paused: 2, away: 3 };

/** Repaints on an interval while something is live; values come from timestamps, so no drift. */
export function useRepaint(active: boolean, ms = 15_000) {
  const [, repaint] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => repaint((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}

/**
 * A member's total for the period, counted up to this moment: the server's
 * figure, plus the minutes their running timer has added since it was read.
 */
export function liveTotal(member: RoomMemberLive, period: "today" | "week", asOf: number, now: number): number {
  const base = period === "today" ? member.todayMs : member.weekMs;
  return member.state === "focusing" ? base + Math.max(0, now - asOf) : base;
}

/** An avatar ringed by what the person is doing right now. */
export function PresenceAvatar({ member, className }: { member: RoomMemberLive; className?: string }) {
  const meta = STATE_META[member.state];
  return (
    <span className={cn("relative inline-flex shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-card", meta.ring, className)}>
      <PersonAvatar
        name={member.name}
        image={member.image}
        className={cn("size-full", member.state === "away" && "opacity-55")}
      />
      {member.state === "focusing" ? (
        <span aria-hidden className="absolute -right-0.5 -bottom-0.5 flex size-3">
          <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex size-3 rounded-full bg-emerald-500 ring-2 ring-card" />
        </span>
      ) : null}
    </span>
  );
}

/** Everyone's focus side by side: a bar each, longest first. */
export function Leaderboard({
  members,
  asOf,
  compact = false,
}: {
  members: RoomMemberLive[];
  asOf: number;
  compact?: boolean;
}) {
  const hydrated = useIsHydrated();
  const [period, setPeriod] = useState<"today" | "week">("today");
  useRepaint(members.some((m) => m.state === "focusing"), 15_000);
  const now = hydrated ? clockNow() : asOf;

  const rows = members
    .map((m) => ({ member: m, ms: liveTotal(m, period, asOf, now) }))
    .sort((a, b) => b.ms - a.ms || a.member.name.localeCompare(b.member.name));
  const max = Math.max(1, ...rows.map((r) => r.ms));

  return (
    <div className={cn(!compact && "bg-card rounded-xl border p-4")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={cn("font-medium", compact ? "text-xs" : "text-sm")}>Leaderboard</h2>
        <div role="tablist" aria-label="Period" className={cn("flex rounded-lg p-0.5", compact ? "bg-white/10" : "bg-muted")}>
          {(["today", "week"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={cn(
                "cursor-pointer rounded-md px-2 py-0.5 text-xs",
                period === p ? (compact ? "bg-white/20" : "bg-background shadow-sm") : "opacity-70",
              )}
            >
              {p === "today" ? "Today" : "This week"}
            </button>
          ))}
        </div>
      </div>
      <ol className={cn(compact ? "space-y-2" : "space-y-3")}>
        {rows.map(({ member, ms }, index) => (
          <li key={member.id} className="flex items-center gap-2.5">
            <span className={cn("tabular w-4 shrink-0 text-right text-xs", compact ? "text-white/60" : "text-muted-foreground")}>
              {index + 1}
            </span>
            <PresenceAvatar member={member} className={compact ? "size-6" : "size-8"} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate font-medium", compact ? "text-xs" : "text-sm")}>
                  {member.name}
                  {member.isSelf ? <span className={compact ? "text-white/60" : "text-muted-foreground"}> (you)</span> : null}
                </span>
                <span className={cn("font-numeric shrink-0", compact ? "text-xs" : "text-sm")}>{formatCompact(ms)}</span>
              </div>
              <div className={cn("mt-1 h-2 overflow-hidden rounded-full", compact ? "bg-white/10" : "bg-muted")}>
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    member.state === "focusing" ? "bg-emerald-500" : compact ? "bg-white/50" : "bg-primary/60",
                  )}
                  initial={false}
                  animate={{ width: `${(ms / max) * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Where a floating reaction rises, spread out but stable for a given key. */
function lane(key: string): number {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return 10 + (Math.abs(hash) % 80);
}

/** How recent another person's reaction must be, when it arrives, to float up. */
const FRESH_MS = 8_000;

/** Buttons to send a reaction, and the reactions floating up as they arrive. */
export function Reactions({
  roomId,
  reactions,
  asOf,
  viewerId,
  compact = false,
}: {
  roomId: string;
  reactions: RoomLiveData["reactions"];
  asOf: number;
  viewerId: string | undefined;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();
  // Reactions already there when you arrived are old news, never animated.
  const [before] = useState(() => new Set(reactions.map((r) => r.id)));
  const [mine, setMine] = useState<{ key: string; emoji: string }[]>([]);
  const sent = useRef(0);

  // Others' reactions float up as polling brings them in; your own float the
  // moment you tap.
  const theirs = reactions
    .filter((r) => !before.has(r.id) && r.userId !== viewerId && asOf - r.at < FRESH_MS)
    .map((r) => ({ key: r.id, emoji: REACTION_EMOJI[r.reaction], name: r.name }));
  const floating = [...theirs, ...mine.map((m) => ({ ...m, name: "You" }))];

  function send(reaction: RoomReaction) {
    sent.current += 1;
    const key = `mine-${sent.current}`;
    setMine((list) => [...list.slice(-8), { key, emoji: REACTION_EMOJI[reaction] }]);
    setTimeout(() => setMine((list) => list.filter((m) => m.key !== key)), 2800);
    startTransition(async () => {
      const result = await sendRoomReaction({ roomId, reaction });
      if (!result.ok) toast.message(result.error);
      else void queryClient.invalidateQueries({ queryKey: roomQueryKey(roomId) });
    });
  }

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full h-48 overflow-hidden">
        <AnimatePresence>
          {floating.map((f) => (
            <motion.div
              key={f.key}
              className="absolute bottom-0 flex flex-col items-center"
              style={{ left: `${lane(f.key)}%` }}
              initial={{ opacity: 0, y: 10, scale: 0.6 }}
              animate={reduceMotion ? { opacity: [0, 1, 0] } : { opacity: [0, 1, 1, 0], y: -150, scale: [0.6, 1.2, 1, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.6, ease: "easeOut" }}
            >
              <span className="text-3xl">{f.emoji}</span>
              <span className={cn("rounded-full px-1.5 text-[10px]", compact ? "bg-black/40 text-white" : "bg-background/80")}>{f.name}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-1.5">
        {ROOM_REACTIONS.map((reaction) => (
          <motion.button
            key={reaction}
            type="button"
            onClick={() => send(reaction)}
            whileTap={reduceMotion ? undefined : { scale: 0.8 }}
            aria-label={`Send ${REACTION_EMOJI[reaction]} to the room`}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-full text-xl transition-colors",
              compact ? "size-9 bg-white/10 hover:bg-white/20" : "bg-muted hover:bg-muted/70 size-10",
            )}
          >
            <span aria-hidden>{REACTION_EMOJI[reaction]}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/** What happened lately in the room. */
function Activity({ data }: { data: RoomLiveData }) {
  const hydrated = useIsHydrated();
  useRepaint(true, 30_000);
  const now = hydrated ? clockNow() : data.asOf;
  if (data.activity.length === 0) return null;
  return (
    <section aria-labelledby="room-activity" className="bg-card rounded-xl border">
      <h2 id="room-activity" className="border-b px-4 py-3 text-sm font-medium">
        Lately
      </h2>
      <ul className="divide-y">
        {data.activity.map((event) => (
          <li key={`${event.kind}-${event.userId}-${event.at}`} className="flex items-center gap-2 px-4 py-2 text-sm">
            {event.kind === "start" ? (
              <>
                <Timer className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{event.name}</span> started{" "}
                  <span className={cn("font-medium", trackColorClasses(event.trackColor).text)}>{event.trackLabel}</span>
                </span>
              </>
            ) : (
              <>
                <span aria-hidden className="shrink-0">
                  🎉
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{event.name}</span> finished{" "}
                  <span className="font-numeric">{formatCompact(event.focusMs)}</span> of focus
                </span>
              </>
            )}
            <span className="text-muted-foreground shrink-0 text-xs">{agoLabel(event.at, now)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MemberRow({
  member,
  roomId,
  canKick,
}: {
  member: RoomMemberLive;
  roomId: string;
  canKick: boolean;
}) {
  const hydrated = useIsHydrated();
  const queryClient = useQueryClient();
  const meta = STATE_META[member.state];
  const Icon = meta.icon;
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  useRepaint(member.state === "focusing");

  const minutes = hydrated && member.session ? formatCompact(elapsedMs(member.session, clockNow())) : null;

  function kick() {
    startTransition(async () => {
      const result = await removeMember({ roomId, userId: member.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${member.name} was removed from the room.`);
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: roomQueryKey(roomId) });
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <PresenceAvatar member={member} className="size-9" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium">{member.name}</span>
          {member.isSelf ? (
            <Badge variant="secondary" className="text-xs">
              You
            </Badge>
          ) : null}
          {member.isOwner ? <Crown className="text-muted-foreground size-3.5" aria-label="Owner" /> : null}
        </div>
        <div className="text-muted-foreground mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs">
          <Icon className="size-3" aria-hidden />
          <span>{meta.label}</span>
          {member.session ? (
            <>
              <span aria-hidden>·</span>
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", trackColorClasses(member.session.trackColor).bg)} />
              <span className="truncate">{member.session.trackLabel}</span>
              {minutes ? <span className="font-numeric text-foreground">{minutes}</span> : null}
            </>
          ) : null}
        </div>
      </div>
      {canKick ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive size-8 cursor-pointer"
            aria-label={`Remove ${member.name} from the room`}
            title="Remove from room"
            onClick={() => setConfirming(true)}
          >
            <UserMinus className="size-4" aria-hidden />
          </Button>
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  They leave the room straight away and stop seeing it. Their sessions stay theirs. You can invite
                  them again later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer" disabled={pending}>
                  Keep them
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
                  disabled={pending}
                  onClick={(event) => {
                    event.preventDefault();
                    kick();
                  }}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </li>
  );
}

/**
 * A room as a place: who is here and what they are doing, a leaderboard of
 * everyone's own focus, reactions to send each other, and what happened
 * lately. Each timer stays its owner's own.
 */
export function RoomLive({ roomId, initial, viewerIsOwner }: { roomId: string; initial: RoomLiveData; viewerIsOwner: boolean }) {
  const { data, error } = useRoomLive(roomId, initial);

  if (error instanceof LeftRoomError || !data) {
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
  const focusing = members.filter((m) => m.state === "focusing");
  const viewerId = members.find((m) => m.isSelf)?.id;

  return (
    <div className="space-y-4">
      {/* Presence: who is here, at a glance. */}
      <section aria-label="Who is here" className="bg-card flex flex-wrap items-center gap-4 rounded-xl border p-4">
        <div className="flex -space-x-1.5">
          {members.slice(0, 8).map((m) => (
            <PresenceAvatar key={m.id} member={m} className="size-9" />
          ))}
        </div>
        <p className="min-w-0 flex-1 text-sm">
          {focusing.length === 0 ? (
            <span className="text-muted-foreground">Nobody is focusing right now. Start a timer and set the pace.</span>
          ) : (
            <>
              <span className="font-medium">
                {focusing.length === 1 ? focusing[0].name : `${focusing.length} people`}
              </span>{" "}
              {focusing.length === 1 ? "is" : "are"} focusing now
            </>
          )}
        </p>
        <Reactions roomId={roomId} reactions={data.reactions} asOf={data.asOf} viewerId={viewerId} />
      </section>

      <Leaderboard members={members} asOf={data.asOf} />

      <Activity data={data} />

      <section aria-labelledby="room-members" className="bg-card rounded-xl border">
        <h2 id="room-members" className="border-b px-4 py-3 text-sm font-medium">
          In the room <span className="text-muted-foreground font-normal">{members.length}</span>
        </h2>
        <ul className="divide-y">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              roomId={roomId}
              canKick={viewerIsOwner && !member.isSelf}
            />
          ))}
        </ul>
        <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
          Updates every few seconds. Everyone keeps their own timer; the leaderboard counts all of each
          person&apos;s focus today.
        </p>
      </section>
    </div>
  );
}
