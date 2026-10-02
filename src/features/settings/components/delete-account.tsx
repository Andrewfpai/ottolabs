"use client";

import { Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount } from "@/features/settings/server/actions";

export function DeleteAccount({ email, isOwner }: { email: string; isOwner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  function confirm() {
    startTransition(async () => {
      const result = await deleteMyAccount({ confirmEmail: typed });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // The sign-in page sits outside the signed-in layout, so the timer bar
      // and everything else that belonged to the old account unmounts.
      router.replace("/sign-in?deleted=1");
    });
  }

  return (
    <>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive border-destructive/40 cursor-pointer gap-1.5"
        onClick={() => {
          setTyped("");
          setOpen(true);
        }}
      >
        <Trash2 className="size-4" aria-hidden />
        Delete my account
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account and data?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This permanently deletes every track, session, note and task, your settings,
                  friendships and room memberships, and rooms you own. It cannot be undone.
                </p>
                <p>
                  {isOwner
                    ? "You are an owner (ALLOWED_EMAILS), so you can still sign in afterwards — it starts a fresh, empty account."
                    : "Your invitation is removed too; an owner would have to invite you again."}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-email">
              Type <span className="font-semibold">{email}</span> to confirm
            </Label>
            <Input
              id="confirm-email"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={pending}>
              Keep my account
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
              disabled={!matches || pending}
              onClick={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              {pending ? "Deleting…" : "Delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
