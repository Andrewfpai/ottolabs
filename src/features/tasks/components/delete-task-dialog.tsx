"use client";

import { useTransition } from "react";
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
import { deleteTask } from "@/features/tasks/server/actions";
import type { TaskWithTrack } from "@/features/tasks/server/queries";

/** Open while `task` is set; closing it clears the task. */
export function DeleteTaskDialog({
  task,
  onClose,
}: {
  task: TaskWithTrack | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!task) return;
    startTransition(async () => {
      const result = await deleteTask({ id: task.id });
      if (result.ok) toast.success("Task deleted.");
      else toast.error(result.error);
      onClose();
    });
  }

  return (
    <AlertDialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>
            “{task?.title}” will be gone for good. If you just do not plan to do it, cancel it
            instead and it stays in the record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={pending}>
            Keep it
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
            onClick={(event) => {
              // Stay open until the delete lands, so a failure is not silent.
              event.preventDefault();
              confirm();
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
