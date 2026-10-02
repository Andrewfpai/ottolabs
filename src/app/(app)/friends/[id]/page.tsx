import { EyeOff } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-header";
import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { parseRangeKey } from "@/features/analytics/lib/compute";
import { LiveBadge } from "@/features/friends/components/live-badge";
import { PersonAvatar } from "@/features/friends/components/person-avatar";
import { UnfriendButton } from "@/features/friends/components/unfriend-button";
import { getFriendProfile } from "@/features/friends/server/queries";

export const metadata: Metadata = { title: "Friend" };

export default async function FriendPage({ params, searchParams }: PageProps<"/friends/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const raw = Array.isArray(query.range) ? query.range[0] : query.range;

  // Null for strangers, pending requests and made-up ids alike: a 404 that
  // does not confirm whether the person exists.
  const profile = await getFriendProfile(id, parseRangeKey(raw));
  if (!profile) notFound();

  const { person, data, live, sharesTrackNames } = profile;

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={person.name} image={person.image} className="size-12" />
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{person.name}</h1>
            {live ? <LiveBadge live={live} /> : null}
          </div>
        </div>
        <UnfriendButton friendId={person.id} name={person.name} />
      </div>

      {!sharesTrackNames ? (
        <p className="text-muted-foreground mb-4 flex items-center gap-1.5 text-xs">
          <EyeOff className="size-3.5" aria-hidden />
          {person.name} keeps their track names private, so tracks are numbered.
        </p>
      ) : null}

      <AnalyticsView data={data} basePath={`/friends/${person.id}`} perspective="friend" />
    </PageContainer>
  );
}
