"use client";

import { Check, Link2, LogIn, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseRoomCode, roomInvitePath } from "@/features/rooms/lib/invite-code";
import { joinRoomByCode, roomInviteCode } from "@/features/rooms/server/actions";

/** Copy a room's invite link to the clipboard, making one if needed. */
export async function copyRoomLink(roomId: string, reset = false): Promise<boolean> {
  const result = await roomInviteCode({ roomId, reset });
  if (!result.ok) {
    toast.error(result.error);
    return false;
  }
  const url = `${window.location.origin}${roomInvitePath(result.data)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success(reset ? "New link copied. The old one no longer works." : "Invite link copied.");
  } catch {
    toast.message(url, { description: "Copy this link and send it." });
  }
  return true;
}

/** Owner: share the room by link, or retire the link and make a new one. */
export function RoomInvite({ roomId }: { roomId: string }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  return (
    <section aria-labelledby="room-invite" className="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4">
      <div className="min-w-0 flex-1">
        <h2 id="room-invite" className="text-sm font-medium">
          Invite by link
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Anyone with access to OttoLabs who has the link can join, friends or not.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer gap-1.5"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (await copyRoomLink(roomId)) setCopied(true);
          })
        }
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy link"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground cursor-pointer gap-1.5"
        disabled={pending}
        title="Make a new link; the old one stops working"
        onClick={() => startTransition(async () => void (await copyRoomLink(roomId, true)))}
      >
        <RefreshCw className="size-3.5" aria-hidden />
        New link
      </Button>
    </section>
  );
}

/** Paste a room link to join it. `onJoined` runs with the room id. */
export function JoinRoomForm({
  onJoined,
  compact = false,
}: {
  onJoined?: (roomId: string) => void | Promise<void>;
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!parseRoomCode(value)) {
      setError("Paste the whole room link, like …/rooms/join/aB3x9Kq2Lm0p");
      return;
    }
    startTransition(async () => {
      const result = await joinRoomByCode({ code: value });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setValue("");
      if (onJoined) await onJoined(result.data);
      else router.push(`/rooms/${result.data}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className={compact ? "space-y-2" : "flex flex-col gap-2 sm:flex-row sm:items-end"}>
        <div className="flex-1 space-y-2">
          <Label htmlFor="room-link">Join with a link</Label>
          <Input
            id="room-link"
            placeholder="https://…/rooms/join/…"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="cursor-pointer gap-1.5" disabled={pending || !value.trim()} aria-busy={pending}>
          <LogIn className="size-4" aria-hidden />
          {pending ? "Joining…" : "Join"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
