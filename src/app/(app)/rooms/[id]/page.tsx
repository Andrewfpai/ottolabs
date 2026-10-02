import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-header";
import { ManagePeople, RoomHeaderActions } from "@/features/rooms/components/room-admin";
import { RoomInvite } from "@/features/rooms/components/room-links";
import { RoomLive } from "@/features/rooms/components/room-live";
import { RoomStart } from "@/features/rooms/components/room-start";
import { getRoomPage } from "@/features/rooms/server/queries";
import { getStartableTracks } from "@/features/tracks/server/queries";

export const metadata: Metadata = { title: "Room" };

export default async function RoomPage({ params }: PageProps<"/rooms/[id]">) {
  const { id } = await params;

  // Null for strangers, invitees who have not joined, ex-members and made-up
  // ids alike: a 404 that does not confirm the room exists.
  const [page, tracks] = await Promise.all([getRoomPage(id), getStartableTracks()]);
  if (!page) notFound();

  const others = page.live.members.filter((m) => !m.isSelf);

  return (
    <PageContainer className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{page.room.name}</h1>
          {page.room.goal ? <p className="text-muted-foreground mt-1 text-sm">Goal: {page.room.goal}</p> : null}
        </div>
        <RoomHeaderActions
          roomId={page.room.id}
          name={page.room.name}
          goal={page.room.goal}
          isOwner={page.isOwner}
        />
      </div>

      <div className="space-y-4">
        <RoomStart roomId={page.room.id} tracks={tracks} />
        <RoomLive roomId={page.room.id} initial={page.live} />
        {page.isOwner ? <RoomInvite roomId={page.room.id} /> : null}
        {page.isOwner ? (
          <ManagePeople
            roomId={page.room.id}
            members={others.map(({ id: memberId, name, image }) => ({ id: memberId, name, image }))}
            invited={page.invited}
            addable={page.addable}
            maxMembers={page.maxMembers}
          />
        ) : null}
      </div>
    </PageContainer>
  );
}
