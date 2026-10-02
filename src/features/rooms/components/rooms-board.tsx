"use client";

import { ChevronRight, DoorOpen, Plus, Timer, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roomNameSchema } from "@/features/rooms/schema";
import { JoinRoomForm } from "@/features/rooms/components/room-links";
import { createRoom, joinRoom, leaveRoom } from "@/features/rooms/server/actions";
import type { RoomSummary } from "@/features/rooms/server/queries";

export function RoomsBoard({ rooms }: { rooms: RoomSummary[] }) {
  const invitations = rooms.filter((r) => r.status === "invited");
  const joined = rooms.filter((r) => r.status === "joined");

  return (
    <div className="space-y-6">
      <CreateRoom />
      <section className="bg-card rounded-xl border p-4">
        <JoinRoomForm />
      </section>

      {invitations.length > 0 ? <Invitations rooms={invitations} /> : null}

      {joined.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="No rooms yet"
          description="A room is a quiet place to focus alongside friends: you see who is studying, on what, and for how long. Create one above, then add friends to it."
        />
      ) : (
        <section aria-label="Your rooms" className="bg-card rounded-xl border">
          <ul className="divide-y">
            {joined.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/rooms/${room.id}`}
                  className="hover:bg-muted/40 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <DoorOpen className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{room.name}</div>
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Users className="size-3" aria-hidden />
                        {room.memberCount} {room.memberCount === 1 ? "person" : "people"}
                      </span>
                      <span className={room.focusingNow > 0 ? "text-primary flex items-center gap-1" : "flex items-center gap-1"}>
                        <Timer className="size-3" aria-hidden />
                        {room.focusingNow} focusing now
                      </span>
                      <span>{room.isOwner ? "You own it" : `Owner: ${room.ownerName}`}</span>
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const check = roomNameSchema.safeParse(name);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Give the room a name.");
      return;
    }
    startTransition(async () => {
      const result = await createRoom({ name: check.data, goal });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Room created. Share its link or add friends.");
      router.push(`/rooms/${result.data}`);
    });
  }

  return (
    <section className="bg-card rounded-xl border p-4">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="room-name">New room</Label>
          <Input
            id="room-name"
            placeholder="Finals grind"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="room-goal">
            Goal <span className="text-muted-foreground font-normal">optional</span>
          </Label>
          <Input
            id="room-goal"
            placeholder="Finish chapter 3"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={120}
          />
        </div>
        <Button type="submit" className="cursor-pointer gap-1.5" disabled={pending || !name.trim()} aria-busy={pending}>
          <Plus className="size-4" aria-hidden />
          {pending ? "Creating…" : "Create room"}
        </Button>
      </form>
      {error ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive mt-2 rounded-lg border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Invitations({ rooms }: { rooms: RoomSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function respond(room: RoomSummary, join: boolean) {
    startTransition(async () => {
      const result = join ? await joinRoom({ roomId: room.id }) : await leaveRoom({ roomId: room.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(join ? `You joined ${room.name}.` : "Invitation declined.");
      if (join) router.push(`/rooms/${room.id}`);
    });
  }

  return (
    <section aria-labelledby="room-invitations" className="bg-card rounded-xl border">
      <div className="border-b px-4 py-3">
        <h2 id="room-invitations" className="text-sm font-medium">
          Invitations <span className="text-muted-foreground font-normal">{rooms.length}</span>
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Joining lets everyone in the room see your timer: when you are focusing, on which track
          (named only if you share track names) and for how long. Never your notes or tasks.
        </p>
      </div>
      <ul className="divide-y">
        {rooms.map((room) => (
          <li key={room.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{room.name}</div>
              <div className="text-muted-foreground text-xs">From {room.ownerName}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="cursor-pointer" disabled={pending} onClick={() => respond(room, true)}>
                Join
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                disabled={pending}
                onClick={() => respond(room, false)}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
