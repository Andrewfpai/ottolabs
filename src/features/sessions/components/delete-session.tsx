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
import { deleteSession } from "@/features/sessions/server/actions";

/**
 * "Delete this session?", confirmed. `summary` names it the way the person
 * sees it: "1h 20m on Calculus, Fri 3 Oct". Milestones already unlocked stay
 * unlocked; the hours and charts drop it.
 */
export function DeleteSessionDialog({
  sessionId,
  summary,
  open,
  onOpenChange,
  onDeleted,
}: {
  sessionId: string;
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteSession({ id: sessionId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Session deleted.");
      onOpenChange(false);
      onDeleted?.();
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this session?</AlertDialogTitle>
          <AlertDialogDescription>
            {summary} will be removed from your log, totals and charts. Its note goes with it. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={pending}>
            Keep it
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            {pending ? "Deleting…" : "Delete session"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A small trash button that asks first. Always visible, so it works on touch screens. */
export function DeleteSessionButton({ sessionId, summary }: { sessionId: string; summary: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive size-8 shrink-0 cursor-pointer"
        aria-label={`Delete session: ${summary}`}
        title="Delete session"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      <DeleteSessionDialog sessionId={sessionId} summary={summary} open={open} onOpenChange={setOpen} />
    </>
  );
}
