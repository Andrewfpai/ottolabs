import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RoomsBoard } from "@/features/rooms/components/rooms-board";
import { getRoomsOverview } from "@/features/rooms/server/queries";

export const metadata: Metadata = { title: "Rooms" };

export default async function RoomsPage() {
  const rooms = await getRoomsOverview();

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Rooms"
        description="Focus alongside friends. Everyone runs their own timer; the room shows who is studying right now."
      />
      <RoomsBoard rooms={rooms} />
    </PageContainer>
  );
}
