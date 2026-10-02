import { DoorOpen, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageContainer } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { joinRoomByCode } from "@/features/rooms/server/actions";
import { getRoomInvite } from "@/features/rooms/server/queries";

export const metadata: Metadata = { title: "Join room" };

/**
 * Where a room's invite link lands. Joining is a button, not a side effect
 * of opening the link: being seen by a room is something you choose.
 */
export default async function JoinRoomPage({ params }: PageProps<"/rooms/join/[code]">) {
  const { code } = await params;
  const invite = await getRoomInvite(code);
  if (invite?.alreadyJoined) redirect(`/rooms/${invite.id}`);

  async function join() {
    "use server";
    const result = await joinRoomByCode({ code });
    redirect(result.ok ? `/rooms/${result.data}` : `/rooms/join/${code}?error=1`);
  }

  return (
    <PageContainer className="flex max-w-md flex-col items-center pt-16 text-center">
      <span className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-2xl">
        <DoorOpen className="size-6" aria-hidden />
      </span>
      {invite ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Join “{invite.name}”?</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Owner: {invite.ownerName} ·{" "}
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              {invite.memberCount} {invite.memberCount === 1 ? "person" : "people"}
            </span>
          </p>
          {invite.goal ? <p className="mt-3 text-sm">Goal: {invite.goal}</p> : null}
          <p className="text-muted-foreground mt-4 text-xs text-balance">
            People in the room see when you are focusing, on what, and for how long. You can leave any time.
          </p>
          <form action={join} className="mt-6">
            <Button type="submit" className="cursor-pointer">
              Join room
            </Button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">That link no longer works</h1>
          <p className="text-muted-foreground mt-2 text-sm">The owner may have made a new one, or the room is full or gone.</p>
          <Button asChild variant="outline" className="mt-6 cursor-pointer">
            <Link href="/rooms">Go to Rooms</Link>
          </Button>
        </>
      )}
    </PageContainer>
  );
}
