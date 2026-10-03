import type { Metadata } from "next";

import { getFriendsOverview } from "@/features/friends/server/queries";
import { getMyRoomInvitations, getMyRooms } from "@/features/rooms/server/queries";
import { FocusScreen } from "@/features/sessions/components/focus-screen";
import { getActiveSession } from "@/features/sessions/server/queries";
import { getOpenTasksByTrack } from "@/features/tasks/server/queries";
import { getStartableTracks } from "@/features/tracks/server/queries";

export const metadata: Metadata = { title: "Focus" };

/**
 * Fullscreen focus mode over a scene of your choosing.
 *
 * Not in the sidebar: you enter it from a running timer, though arriving with
 * nothing running offers to start one. The session is read on the server so
 * the timer is right in the first paint; tracks, tasks and rooms come along
 * for starting here and for Study together.
 */
export default async function FocusPage({ searchParams }: PageProps<"/focus">) {
  const { track } = await searchParams;
  const [session, tracks, tasksByTrack, rooms, overview, invitations] = await Promise.all([
    getActiveSession(),
    getStartableTracks(),
    getOpenTasksByTrack(),
    getMyRooms(),
    getFriendsOverview(),
    getMyRoomInvitations(),
  ]);

  return (
    <FocusScreen
      initial={session}
      tracks={tracks}
      tasksByTrack={tasksByTrack}
      rooms={rooms}
      // Arriving from a track card: that track is ready to start.
      initialTrackId={typeof track === "string" ? track : undefined}
      friends={overview.people.filter((p) => !p.isSelf)}
      invitations={invitations}
    />
  );
}
