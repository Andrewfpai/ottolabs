"use client";

import { useQueryClient } from "@tanstack/react-query";
import { DoorOpen, ExternalLink, Link2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { roomNameSchema } from "@/features/rooms/schema";
import { copyRoomLink, JoinRoomForm } from "@/features/rooms/components/room-links";
import { createRoom, focusInRoom } from "@/features/rooms/server/actions";
import type { MyRoom } from "@/features/rooms/server/queries";
import { ACTIVE_SESSION_KEY } from "@/features/sessions/hooks/use-active-session";
import { cn } from "@/lib/utils";

type Tab = "mine" | "create" | "join";

/**
 * Study together without leaving focus mode: bring the running timer into
 * one of your rooms, make a room and share its link, or join one from a
 * link. Your session stays your own; the room just sees it.
 */
export function StudyTogether({
  open,
  onOpenChange,
  rooms,
  currentRoomId,
  running,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: MyRoom[];
  currentRoomId: string | null;
  /** Whether a timer is running to bring along. */
  running: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(rooms.length > 0 ? "mine" : "create");
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");

  async function bringInto(roomId: string, quiet = false) {
    if (!running) {
      router.push(`/rooms/${roomId}`);
      return;
    }
    const result = await focusInRoom({ roomId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
    router.refresh();
    if (!quiet) toast.success("You are studying in the room now.");
  }

  function create(event: React.FormEvent) {
    event.preventDefault();
    const check = roomNameSchema.safeParse(name);
    if (!check.success) {
      toast.error(check.error.issues[0]?.message ?? "Give the room a name.");
      return;
    }
    startTransition(async () => {
      const result = await createRoom({ name: check.data, goal });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      await bringInto(result.data, true);
      await copyRoomLink(result.data);
      setName("");
      setGoal("");
      setTab("mine");
    });
  }

  const tabs: { id: Tab; label: string; hint: string; icon: typeof DoorOpen }[] = [
    { id: "mine", label: "My rooms", hint: `${rooms.length} joined`, icon: DoorOpen },
    { id: "create", label: "New room", hint: "Create and share", icon: Plus },
    { id: "join", label: "Join room", hint: "Paste a link", icon: Link2 },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Study together</SheetTitle>
          <SheetDescription>
            Focus alongside others in real time. Your own timer stays yours; the room sees you studying.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          <div role="tablist" aria-label="Study together" className="grid grid-cols-3 gap-2">
            {tabs.map(({ id, label, hint, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "cursor-pointer rounded-xl border p-2.5 text-left transition-colors",
                  tab === id ? "border-primary bg-primary/5" : "hover:bg-muted",
                )}
              >
                <Icon className="text-muted-foreground mb-1.5 size-4" aria-hidden />
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-muted-foreground block text-xs">{hint}</span>
              </button>
            ))}
          </div>

          {tab === "mine" ? (
            rooms.length === 0 ? (
              <p className="text-muted-foreground text-sm">You are not in any room yet. Make one, or join with a link.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {rooms.map((room) => {
                  const here = room.id === currentRoomId;
                  return (
                    <li key={room.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{room.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {here ? "You are studying here" : (room.goal ?? (room.isOwner ? "You own it" : "Joined"))}
                        </p>
                      </div>
                      {here ? null : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          disabled={pending}
                          onClick={() => startTransition(() => bringInto(room.id))}
                        >
                          {running ? "Study here" : "Open"}
                        </Button>
                      )}
                      {room.isOwner ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 cursor-pointer"
                          aria-label={`Copy the invite link for ${room.name}`}
                          title="Copy invite link"
                          onClick={() => void copyRoomLink(room.id)}
                        >
                          <Link2 className="size-4" aria-hidden />
                        </Button>
                      ) : null}
                      <Button asChild size="icon" variant="ghost" className="size-8 cursor-pointer">
                        <Link href={`/rooms/${room.id}`} aria-label={`Open ${room.name}`}>
                          <ExternalLink className="size-4" aria-hidden />
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {tab === "create" ? (
            <form onSubmit={create} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="together-name">Room name</Label>
                <Input id="together-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Finals grind" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="together-goal">
                  Room goal <span className="text-muted-foreground font-normal">optional</span>
                </Label>
                <Input id="together-goal" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={120} placeholder="Finish chapter 3" />
                <p className="text-muted-foreground text-xs">Shown to everyone in the room.</p>
              </div>
              <Button type="submit" className="w-full cursor-pointer" disabled={pending || !name.trim()} aria-busy={pending}>
                {running ? "Create, study here and copy link" : "Create and copy link"}
              </Button>
            </form>
          ) : null}

          {tab === "join" ? (
            <JoinRoomForm
              compact
              onJoined={async (roomId) => {
                await bringInto(roomId, true);
                toast.success(running ? "Joined. You are studying in the room now." : "Joined the room.");
                setTab("mine");
              }}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
