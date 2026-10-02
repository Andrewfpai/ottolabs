"use client";

import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { expiresIn, INVITE_EXPIRY_OPTIONS, inviteStatus } from "@/features/access/lib/invite-links";
import { createInviteLink, deleteInviteLink } from "@/features/access/server/actions";
import type { InviteLinkRow } from "@/features/access/server/queries";
import { dayKey, formatDayKey } from "@/lib/time/calendar-day";

/**
 * One-time invite links: for letting a friend in without knowing which
 * Google account they will use.
 */
export function InviteLinksManager({
  links,
  now,
  timeZone,
}: {
  links: InviteLinkRow[];
  now: number;
  timeZone: string;
}) {
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState<number>(INVITE_EXPIRY_OPTIONS[0].hours);
  const [fresh, setFresh] = useState<{ label: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createInviteLink({ label, hours });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFresh({ label: label.trim(), url: `${window.location.origin}/invite/${result.data.token}` });
      setCopied(false);
      setLabel("");
    });
  }

  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.url);
      setCopied(true);
      toast.success("Link copied. Send it to them.");
    } catch {
      toast.error("Could not copy. Select the link and copy it yourself.");
    }
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteInviteLink({ id });
      if (!result.ok) toast.error(result.error);
    });
  }

  const date = (d: Date) => formatDayKey(dayKey(d, timeZone), { day: "numeric", month: "short" });

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="invite-label">Invite link for</Label>
          <Input
            id="invite-label"
            value={label}
            maxLength={40}
            placeholder="Farrel"
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
          <SelectTrigger aria-label="Link lasts for" className="w-full cursor-pointer sm:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITE_EXPIRY_OPTIONS.map((o) => (
              <SelectItem key={o.hours} value={String(o.hours)} className="cursor-pointer">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" className="cursor-pointer gap-1.5" disabled={pending || !label.trim()} aria-busy={pending}>
          <Link2 className="size-4" aria-hidden />
          Make link
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {fresh ? (
        <div className="bg-primary/5 border-primary/30 space-y-2 rounded-lg border p-3">
          <p className="text-sm">
            Link for <span className="font-medium">{fresh.label}</span>. It is shown only now, so copy it before
            leaving this page.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={fresh.url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            <Button type="button" variant="outline" className="cursor-pointer gap-1.5" onClick={copy}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}

      {links.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {links.map((link) => {
            const status = inviteStatus(link, now);
            return (
              <li key={link.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{link.label}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {status === "used"
                      ? `Joined as ${link.usedByEmail} on ${date(link.usedAt!)}`
                      : status === "expired"
                        ? `Expired ${date(link.expiresAt)}, unused`
                        : `Waiting · expires ${expiresIn(link.expiresAt, now)}`}
                  </p>
                </div>
                <Badge variant={status === "waiting" ? "secondary" : "outline"} className="text-xs">
                  {status === "used" ? "Used" : status === "expired" ? "Expired" : "Open"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive size-8 cursor-pointer"
                  disabled={pending}
                  onClick={() => remove(link.id)}
                  aria-label={status === "waiting" ? `Withdraw the link for ${link.label}` : `Remove the link for ${link.label}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Whoever opens the link and signs in with Google first gets access, with whatever Google account they choose.
        Removing a used link does not remove their access; do that in the list below.
      </p>
    </div>
  );
}
