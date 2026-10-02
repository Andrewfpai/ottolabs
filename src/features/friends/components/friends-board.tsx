"use client";

import { Check, Flame, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiveBadge } from "@/features/friends/components/live-badge";
import { PersonAvatar } from "@/features/friends/components/person-avatar";
import { weeklyStandings } from "@/features/friends/lib/sharing";
import { parseFriendHandle } from "@/features/friends/lib/username";
import {
  cancelRequest,
  respondToRequest,
  sendFriendRequest,
} from "@/features/friends/server/actions";
import type { FriendRequest, FriendsOverview } from "@/features/friends/server/queries";
import { formatCompact } from "@/lib/time/elapsed";

export function FriendsBoard({ overview }: { overview: FriendsOverview }) {
  const standings = weeklyStandings(overview.people);
  const maxWeek = Math.max(1, ...standings.map((p) => p.weekMs));
  const hasFriends = standings.length > 1;

  return (
    <div className="space-y-6">
      <AddFriend myUsername={overview.people.find((p) => p.isSelf)?.username ?? null} />

      {overview.incoming.length > 0 ? (
        <RequestList title="Requests for you" requests={overview.incoming} kind="incoming" />
      ) : null}
      {overview.outgoing.length > 0 ? (
        <RequestList title="Waiting for an answer" requests={overview.outgoing} kind="outgoing" />
      ) : null}

      <section aria-labelledby="this-week" className="bg-card rounded-xl border">
        <div className="border-b px-4 py-3">
          <h2 id="this-week" className="text-sm font-medium">
            This week
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Most focus first. Each person&apos;s week and day follow their own settings.
          </p>
        </div>

        <ul className="divide-y">
          {standings.map((person) => (
            <li key={person.id}>
              <Link
                href={person.isSelf ? "/analytics" : `/friends/${person.id}`}
                className="hover:bg-muted/40 flex items-center gap-3 px-4 py-3 transition-colors"
              >
                <PersonAvatar name={person.name} image={person.image} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium">{person.name}</span>
                    {person.username ? (
                      <span className="text-muted-foreground truncate text-xs">@{person.username}</span>
                    ) : null}
                    {person.isSelf ? (
                      <Badge variant="secondary" className="text-xs">
                        You
                      </Badge>
                    ) : null}
                    {person.live ? <LiveBadge live={person.live} /> : null}
                  </div>
                  <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${(person.weekMs / maxWeek) * 100}%` }}
                    />
                  </div>
                  <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 text-xs">
                    <span>
                      <span className="text-foreground tabular font-medium">{formatCompact(person.weekMs)}</span>{" "}
                      this week
                    </span>
                    <span>
                      <span className="tabular">{formatCompact(person.todayMs)}</span> today
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="size-3" aria-hidden />
                      {person.streak} {person.streak === 1 ? "day" : "days"}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {!hasFriends ? (
          <p className="text-muted-foreground border-t px-4 py-4 text-sm">
            No friends yet. Send a request above. Once they accept, you will see each other&apos;s
            focus time here — never notes or tasks.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function AddFriend({ myUsername }: { myUsername: string | null }) {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!parseFriendHandle(handle)) {
      setError("Enter a username like @budi, or an email address.");
      return;
    }
    startTransition(async () => {
      const result = await sendFriendRequest({ handle });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setHandle("");
      toast.success(
        result.data === "accepted"
          ? "They had already asked you, so you are now friends."
          : "Request sent. You will see each other once they accept.",
      );
    });
  }

  return (
    <section aria-labelledby="add-friend" className="bg-card rounded-xl border p-4">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="friend-handle" id="add-friend">
            Add a friend
          </Label>
          <Input
            id="friend-handle"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="@username or email"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        <Button type="submit" className="cursor-pointer gap-1.5" disabled={pending || !handle.trim()} aria-busy={pending}>
          <UserPlus className="size-4" aria-hidden />
          {pending ? "Sending…" : "Send request"}
        </Button>
      </form>
      {error ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive mt-2 rounded-lg border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">
          {myUsername ? (
            <>
              Friends can add you as <span className="text-foreground font-medium">@{myUsername}</span>.{" "}
            </>
          ) : (
            <>
              <Link href="/settings#username" className="text-foreground underline underline-offset-4">
                Pick a username
              </Link>{" "}
              so friends can add you without your email.{" "}
            </>
          )}
          They need access to this OttoLabs and to have signed in once. Friends see each other&apos;s
          focus time and streaks; what else is shared is up to each of you in Settings.
        </p>
      )}
    </section>
  );
}

function RequestList({
  title,
  requests,
  kind,
}: {
  title: string;
  requests: FriendRequest[];
  kind: "incoming" | "outgoing";
}) {
  const [pending, startTransition] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "That did not work.");
    });
  }

  return (
    <section aria-label={title} className="bg-card rounded-xl border">
      <h2 className="border-b px-4 py-3 text-sm font-medium">
        {title} <span className="text-muted-foreground font-normal">{requests.length}</span>
      </h2>
      <ul className="divide-y">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <PersonAvatar name={request.person.name} image={request.person.image} className="size-8" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{request.person.name}</div>
              <div className="text-muted-foreground truncate text-xs">
                {request.person.username ? `@${request.person.username}` : request.person.email}
              </div>
            </div>
            {kind === "incoming" ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="cursor-pointer gap-1"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => respondToRequest({ id: request.id, accept: true }),
                      `You and ${request.person.name} are now friends.`,
                    )
                  }
                >
                  <Check className="size-3.5" aria-hidden />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer gap-1"
                  disabled={pending}
                  onClick={() =>
                    act(() => respondToRequest({ id: request.id, accept: false }), "Request declined.")
                  }
                >
                  <X className="size-3.5" aria-hidden />
                  Decline
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                disabled={pending}
                onClick={() => act(() => cancelRequest({ id: request.id }), "Request cancelled.")}
              >
                Cancel request
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
