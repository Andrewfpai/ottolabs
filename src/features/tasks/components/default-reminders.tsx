"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ReminderOffsetsEditor } from "@/features/tasks/components/reminder-offsets-editor";
import { setDefaultTaskReminders } from "@/features/tasks/server/actions";

/** The reminders every new task starts with. Saves on each change. */
export function DefaultTaskReminders({ initial }: { initial: number[] }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function change(next: number[]) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await setDefaultTaskReminders({ reminders: next });
      if (!result.ok) {
        setValue(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Default task reminders</p>
      <ReminderOffsetsEditor value={value} onChange={change} disabled={pending} />
      <p className="text-muted-foreground text-xs">
        Every new task starts with these, quick-added ones included. Change them per task in its edit form. Already
        existing tasks keep theirs.
      </p>
    </div>
  );
}
