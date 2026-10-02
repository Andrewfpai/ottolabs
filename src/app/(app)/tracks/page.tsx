import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { getOpenTasksByTrack } from "@/features/tasks/server/queries";
import { TracksGrid } from "@/features/tracks/components/tracks-grid";
import { getTracksWithStats } from "@/features/tracks/server/queries";

export const metadata: Metadata = { title: "Tracks" };

export default async function TracksPage() {
  const [tracks, tasks] = await Promise.all([
    getTracksWithStats({ includeArchived: true }),
    getOpenTasksByTrack(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Tracks"
        description="The things you are learning. Focus sessions accumulate against a track."
      />
      <TracksGrid tracks={tracks} tasks={tasks} />
    </PageContainer>
  );
}
