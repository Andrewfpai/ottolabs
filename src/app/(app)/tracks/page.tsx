import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { TracksGrid } from "@/features/tracks/components/tracks-grid";
import { getTracksWithStats } from "@/features/tracks/server/queries";

export const metadata: Metadata = { title: "Tracks" };

export default async function TracksPage() {
  const tracks = await getTracksWithStats({ includeArchived: true });

  return (
    <PageContainer>
      <PageHeader
        title="Tracks"
        description="The things you are learning. Focus sessions accumulate against a track."
      />
      <TracksGrid tracks={tracks} />
    </PageContainer>
  );
}
