"use client";

import { History, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/layout/empty-state";
import { TrackIcon } from "@/components/track-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Track } from "@/db/schema";
import { SessionFormDialog } from "@/features/sessions/components/session-form-dialog";
import { deleteSession } from "@/features/sessions/server/actions";
import type { SessionWithTrack } from "@/features/sessions/server/queries";
import { elapsedMs, formatCompact } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

function formatWhen(date: Date, timeZone: string): { day: string; time: string } {
  return {
    day: new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone,
    }).format(date),
    time: new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(date),
  };
}

export function SessionsTable({
  sessions,
  tracks,
  timeZone,
}: {
  sessions: SessionWithTrack[];
  tracks: Track[];
  timeZone: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SessionWithTrack | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [, startTransition] = useTransition();

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(session: SessionWithTrack) {
    setEditing(session);
    setFormOpen(true);
  }

  function remove(session: SessionWithTrack) {
    startTransition(async () => {
      const result = await deleteSession({ id: session.id });
      if (result.ok) {
        toast.success("Session deleted.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const dialog = (
    <SessionFormDialog
      // Remount per target so fields reset rather than carrying values over.
      key={editing?.id ?? "manual"}
      open={formOpen}
      onOpenChange={setFormOpen}
      tracks={tracks}
      session={editing}
    />
  );

  if (sessions.length === 0) {
    return (
      <>
        <EmptyState
          icon={History}
          title="No sessions yet"
          description={
            tracks.length === 0
              ? "Create a track first, then start a timer against it."
              : "Start a timer from the Tracks page, or log time you already spent by hand."
          }
          action={
            tracks.length > 0 ? (
              <Button className="cursor-pointer gap-2" onClick={openCreate}>
                <Plus className="size-4" aria-hidden />
                Log a session
              </Button>
            ) : undefined
          }
        />
        {dialog}
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="outline"
          className="cursor-pointer gap-2"
          onClick={openCreate}
          disabled={tracks.length === 0}
        >
          <Plus className="size-4" aria-hidden />
          Log a session
        </Button>
      </div>

      {/* Wide content scrolls inside its own container so the page body never does. */}
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[150px]">When</TableHead>
              <TableHead>Track</TableHead>
              <TableHead className="w-[110px] text-right">Focus</TableHead>
              <TableHead className="w-[110px]">Mode</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => {
              const when = formatWhen(session.startedAt, timeZone);
              const colors = trackColorClasses(session.track.color);
              const focusMs = elapsedMs(session);

              return (
                <TableRow key={session.id} className="group">
                  <TableCell className="align-top">
                    <div className="text-sm font-medium">{when.day}</div>
                    <div className="text-muted-foreground font-numeric text-xs">
                      {when.time}
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-md",
                          colors.surface,
                          colors.text,
                        )}
                      >
                        <TrackIcon name={session.track.icon} className="size-3.5" />
                      </span>
                      <span className="truncate text-sm">{session.track.title}</span>
                    </span>
                  </TableCell>

                  <TableCell className="font-numeric align-top text-right text-sm font-medium">
                    {formatCompact(focusMs)}
                    {session.pausedMs > 0 ? (
                      <div className="text-muted-foreground text-xs font-normal">
                        +{formatCompact(session.pausedMs)} paused
                      </div>
                    ) : null}
                  </TableCell>

                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {session.mode === "pomodoro" ? (
                        <Badge variant="secondary" className="text-xs">
                          Pomodoro
                        </Badge>
                      ) : null}
                      {session.endReason === "auto_closed" ? (
                        <Badge
                          variant="outline"
                          className="text-warning border-warning/40 text-xs"
                          title="Closed automatically when the heartbeat stopped. The end time is the last heartbeat."
                        >
                          Auto-closed
                        </Badge>
                      ) : null}
                      {session.endReason === "manual_entry" ? (
                        <Badge variant="outline" className="text-xs">
                          Added by hand
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground max-w-xs align-top text-sm">
                    {session.note ? (
                      <span className="line-clamp-2">{session.note}</span>
                    ) : (
                      <span className="opacity-50">—</span>
                    )}
                  </TableCell>

                  <TableCell className="align-top">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground size-8 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                          aria-label="Session actions"
                        >
                          <MoreVertical className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onSelect={() => openEdit(session)}
                        >
                          <Pencil className="size-4" aria-hidden />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive cursor-pointer gap-2"
                          onSelect={() => remove(session)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {dialog}
    </>
  );
}
