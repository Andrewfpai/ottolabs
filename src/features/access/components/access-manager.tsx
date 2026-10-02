"use client";

import { Crown, Mail, Trash2, UserCheck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteSchema } from "@/features/access/schema";
import { inviteEmail, removeInvite } from "@/features/access/server/actions";
import type { AccessList } from "@/features/access/server/queries";
import { dayKey, formatDayKey } from "@/lib/time/calendar-day";

export function AccessManager({ access, timeZone }: { access: AccessList; timeZone: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviting, startInvite] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);
  const [removePending, startRemove] = useTransition();

  function invite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const check = inviteSchema.safeParse({ email });
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    startInvite(async () => {
      const result = await inviteEmail(check.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmail("");
      toast.success(`${result.data} can now sign in.`);
    });
  }

  function confirmRemove() {
    const target = removing;
    if (!target) return;
    startRemove(async () => {
      const result = await removeInvite({ email: target });
      if (result.ok) toast.success(`Removed ${target}. They have been signed out.`);
      else toast.error(result.error);
      setRemoving(null);
    });
  }

  return (
    <>
      <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="invite-email">Invite someone</Label>
          <Input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="friend@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="cursor-pointer gap-1.5" disabled={inviting || !email.trim()} aria-busy={inviting}>
          <Mail className="size-4" aria-hidden />
          {inviting ? "Inviting…" : "Invite"}
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
      <p className="text-muted-foreground mt-2 text-xs">
        They sign in with that Google account and get their own, separate tracks, sessions and
        tasks. They cannot see yours.
      </p>

      <ul className="mt-5 divide-y rounded-lg border">
        {access.owners.map((owner) => (
          <li key={owner} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <Crown className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm">{owner}</span>
            <Badge variant="secondary" className="text-xs">
              Owner
            </Badge>
            <span className="text-muted-foreground w-full pl-7 text-xs">Set in ALLOWED_EMAILS</span>
          </li>
        ))}
        {access.invites.map((invite) => (
          <li key={invite.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <UserCheck className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm" title={invite.email}>
              {invite.email}
            </span>
            {/* Own line, last: the email gets the full row width on a phone. */}
            <span className="text-muted-foreground order-last w-full pl-7 text-xs">
              {invite.hasSignedIn ? "Has signed in" : "Not signed in yet"} · invited{" "}
              {formatDayKey(dayKey(invite.createdAt, timeZone), { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive -my-1 size-8 cursor-pointer"
              aria-label={`Remove access for ${invite.email}`}
              onClick={() => setRemoving(invite.email)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
        {access.invites.length === 0 ? (
          <li className="text-muted-foreground px-3 py-3 text-sm">
            Nobody else is invited yet.
          </li>
        ) : null}
      </ul>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove access?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing} will be signed out on every device and cannot sign back in. Their data is
              kept, so inviting them again restores it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={removePending}>
              Keep access
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
              onClick={(event) => {
                event.preventDefault();
                confirmRemove();
              }}
              disabled={removePending}
            >
              {removePending ? "Removing…" : "Remove access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
