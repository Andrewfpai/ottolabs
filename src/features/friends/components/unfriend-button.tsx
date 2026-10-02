"use client";

import { UserMinus } from "lucide-react";
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
import { unfriend } from "@/features/friends/server/actions";

export function UnfriendButton({ friendId, name }: { friendId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await unfriend({ friendId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`You and ${name} are no longer friends.`);
      setOpen(false);
      router.push("/friends");
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" className="cursor-pointer gap-1.5" onClick={() => setOpen(true)}>
        <UserMinus className="size-4" aria-hidden />
        Unfriend
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfriend {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will both stop seeing each other&apos;s statistics straight away. Either of you can
              send a new request later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={pending}>
              Stay friends
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
              onClick={(event) => {
                event.preventDefault();
                confirm();
              }}
              disabled={pending}
            >
              {pending ? "Removing…" : "Unfriend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
