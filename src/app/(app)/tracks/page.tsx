import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { TracksGrid } from "@/features/tracks/components/tracks-grid";
import { getPlanSummaries } from "@/features/study-plan/server/queries";
import { getTracksWithStats } from "@/features/tracks/server/queries";

export const metadata: Metadata = { title: "Tracks" };

export default async function TracksPage() {
  const [tracks, plans] = await Promise.all([
    getTracksWithStats({ includeArchived: true }),
    getPlanSummaries(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Tracks"
        description="The things you are learning. Focus sessions accumulate against a track."
      />
      <TracksGrid tracks={tracks} plans={Object.fromEntries(plans)} />
    </PageContainer>
  );
}
