"use client";

import { LogOut, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/features/friends/components/person-avatar";
import { roomNameSchema } from "@/features/rooms/schema";
import {
  addMember,
  deleteRoom,
  leaveRoom,
  removeMember,
  renameRoom,
  setRoomGoal,
} from "@/features/rooms/server/actions";

type Person = { id: string; name: string; image: string | null };
type Result = { ok: boolean; error?: string };

function useAction() {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>, success: string, then?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "That did not work.");
        return;
      }
      toast.success(success);
      then?.();
    });
  return { pending, run };
}

/** Rename and delete for the owner; leave for everyone else. */
export function RoomHeaderActions({
  roomId,
  name,
  goal,
  isOwner,
}: {
  roomId: string;
  name: string;
  goal: string | null;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [goalDraft, setGoalDraft] = useState(goal ?? "");
  const [confirming, setConfirming] = useState(false);

  const leaveOrDelete = () =>
    run(
      () => (isOwner ? deleteRoom({ roomId }) : leaveRoom({ roomId })),
      isOwner ? "Room deleted." : "You left the room.",
      () => router.push("/rooms"),
    );

  return (
    <div className="flex gap-2">
      {isOwner ? (
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer gap-1.5"
          onClick={() => {
            setDraft(name);
            setGoalDraft(goal ?? "");
            setRenaming(true);
          }}
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Button>
      ) : null}
      <Button variant="outline" size="sm" className="cursor-pointer gap-1.5" onClick={() => setConfirming(true)}>
        {isOwner ? <Trash2 className="size-3.5" aria-hidden /> : <LogOut className="size-3.5" aria-hidden />}
        {isOwner ? "Delete" : "Leave"}
      </Button>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-sm">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const check = roomNameSchema.safeParse(draft);
              if (!check.success) {
                toast.error(check.error.issues[0]?.message ?? "Give the room a name.");
                return;
              }
              run(
                async () => {
                  const renamed = await renameRoom({ roomId, name: check.data });
                  if (!renamed.ok || goalDraft.trim() === (goal ?? "")) return renamed;
                  return setRoomGoal({ roomId, goal: goalDraft });
                },
                "Room updated.",
                () => setRenaming(false),
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit room</DialogTitle>
              <DialogDescription>Everyone in the room sees the name and goal.</DialogDescription>
            </DialogHeader>
            <Input
              aria-label="Room name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={60}
              autoFocus
            />
            <Input
              aria-label="Room goal"
              placeholder="Goal, optional: Finish chapter 3"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              maxLength={120}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" className="cursor-pointer" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
              <Button type="submit" className="cursor-pointer" disabled={pending || !draft.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isOwner ? `Delete “${name}”?` : `Leave “${name}”?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {isOwner
                ? "Everyone is removed from the room. Their sessions and hours are kept; they just stop counting as this room's."
                : "The room stops seeing your timer straight away. Your sessions stay yours. The owner can add you again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
              onClick={(event) => {
                event.preventDefault();
                leaveOrDelete();
              }}
              disabled={pending}
            >
              {isOwner ? "Delete room" : "Leave room"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Owner only: invite friends and withdraw invitations. Removing members is in the member list. */
export function ManagePeople({
  roomId,
  members,
  invited,
  addable,
  maxMembers,
}: {
  roomId: string;
  /** Joined members other than the owner: counted toward the limit, listed elsewhere. */
  members: Person[];
  invited: Person[];
  addable: Person[];
  maxMembers: number;
}) {
  const { pending, run } = useAction();
  const full = members.length + invited.length + 1 >= maxMembers;

  const row = (person: Person, action: React.ReactNode, note?: string) => (
    <li key={person.id} className="flex items-center gap-3 px-4 py-2.5">
      <PersonAvatar name={person.name} image={person.image} className="size-8" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{person.name}</div>
        {note ? <div className="text-muted-foreground text-xs">{note}</div> : null}
      </div>
      {action}
    </li>
  );

  return (
    <section aria-labelledby="manage-people" className="bg-card rounded-xl border">
      <div className="border-b px-4 py-3">
        <h2 id="manage-people" className="text-sm font-medium">
          Invite friends
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Add friends. They see the room once they join, and joining lets the room see their timer.
          Up to {maxMembers} people.
        </p>
      </div>
      <ul className="divide-y">
        {invited.map((person) =>
          row(
            person,
            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer gap-1"
              disabled={pending}
              onClick={() => run(() => removeMember({ roomId, userId: person.id }), "Invitation withdrawn.")}
            >
              <X className="size-3.5" aria-hidden />
              Withdraw
            </Button>,
            "Invited, not joined yet",
          ),
        )}
        {addable.map((person) =>
          row(
            person,
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer gap-1"
              disabled={pending || full}
              onClick={() => run(() => addMember({ roomId, userId: person.id }), `Invited ${person.name}.`)}
            >
              <UserPlus className="size-3.5" aria-hidden />
              Add
            </Button>,
          ),
        )}
        {invited.length + addable.length === 0 ? (
          <li className="text-muted-foreground px-4 py-3 text-sm">
            Make friends on the Friends page first, then add them here.
          </li>
        ) : null}
      </ul>
      {full ? (
        <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
          The room is full. Remove someone or withdraw an invitation to add another person.
        </p>
      ) : null}
    </section>
  );
}
