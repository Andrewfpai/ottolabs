/**
 * Everything a viewer may read about their friends — and nothing else.
 *
 * The one rule: a friend's data is only loaded after `acceptedFriend` has
 * confirmed an accepted friendship between the viewer and that person. A
 * pending request, a stranger, or a made-up id all come back as null, which
 * the page turns into a 404, so a URL cannot even confirm someone exists.
 *
 * Never loaded for a friend: session notes, tags, tasks, settings beyond the
 * ones needed to compute their numbers in their own time zone.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { focusSessions, friendships, tracks, userSettings, users } from "@/db/schema";
import {
  type AnalyticsData,
  type AnalyticsRangeKey,
  type AnalyticsSettings,
  analyticsWindow,
  computeAnalytics,
  computeFocusSummary,
} from "@/features/analytics/lib/compute";
import type { SplittableSession } from "@/features/analytics/lib/split";
import { displayName, redactTrackTitles } from "@/features/friends/lib/sharing";
import { userPicture } from "@/features/friends/server/picture";
import { isHeartbeatFresh } from "@/features/sessions/lib/staleness";
import { requireUser } from "@/lib/auth-guard";
import { addDays, zonedInstant } from "@/lib/time/calendar-day";

export type Person = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** Null until they pick one in Settings. */
  username: string | null;
};

/** A friend's running timer, only when they share it and it is genuinely live. */
export type LiveStatus = {
  startedAt: Date;
  pausedMs: number;
  pausedAt: Date | null;
  trackLabel: string;
  trackColor: string;
};

export type FriendCard = Person & {
  isSelf: boolean;
  todayMs: number;
  weekMs: number;
  streak: number;
  live: LiveStatus | null;
};

export type FriendRequest = { id: string; person: Person; createdAt: Date };

export type FriendsOverview = {
  /** You and your friends, unsorted; the page orders them. */
  people: FriendCard[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
};

const personColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  image: userPicture,
  username: users.username,
};

type PersonRow = { id: string; name: string | null; email: string; image: string | null; username: string | null };

function toPerson(row: PersonRow): Person {
  return { id: row.id, name: displayName(row), email: row.email, image: row.image, username: row.username };
}

type SharingSettings = AnalyticsSettings & { shareTrackNames: boolean; shareLiveStatus: boolean };

async function loadSettings(userIds: string[]): Promise<Map<string, SharingSettings>> {
  if (userIds.length === 0) return new Map();
  const rows = await db.select().from(userSettings).where(inArray(userSettings.userId, userIds));
  return new Map(
    rows.map((r) => [
      r.userId,
      {
        timeZone: r.timezone,
        dayStartHour: r.dayStartHour,
        weekStartsOn: r.weekStartsOn,
        shareTrackNames: r.shareTrackNames,
        shareLiveStatus: r.shareLiveStatus,
      },
    ]),
  );
}

/** A missing settings row (users created before settings existed) reads as private UTC. */
const FALLBACK_SETTINGS: SharingSettings = {
  timeZone: "UTC",
  dayStartHour: 4,
  weekStartsOn: 1,
  shareTrackNames: false,
  shareLiveStatus: false,
};

/**
 * Finished sessions only — timestamps, never notes or tags.
 * `since` is generous; per-person windows are applied by the compute step.
 */
async function loadFinishedSessions(userIds: string[], since: Date) {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: focusSessions.userId,
      trackId: focusSessions.trackId,
      startedAt: focusSessions.startedAt,
      endedAt: focusSessions.endedAt,
      pausedMs: focusSessions.pausedMs,
      pausedAt: focusSessions.pausedAt,
    })
    .from(focusSessions)
    .where(
      and(
        inArray(focusSessions.userId, userIds),
        isNotNull(focusSessions.endedAt),
        gte(focusSessions.startedAt, since),
      ),
    );
}

async function loadTracks(userIds: string[]) {
  if (userIds.length === 0) return [];
  return db
    .select({ id: tracks.id, userId: tracks.userId, title: tracks.title, color: tracks.color })
    .from(tracks)
    .where(inArray(tracks.userId, userIds))
    .orderBy(asc(tracks.sortOrder), asc(tracks.createdAt));
}

/** Live timers for the people who share theirs, filtered to fresh heartbeats. */
async function loadLive(
  userIds: string[],
  settings: Map<string, SharingSettings>,
  trackLabels: Map<string, { title: string; color: string }>,
  now: number,
): Promise<Map<string, LiveStatus>> {
  const sharing = userIds.filter((id) => settings.get(id)?.shareLiveStatus);
  if (sharing.length === 0) return new Map();

  const rows = await db
    .select({
      userId: focusSessions.userId,
      trackId: focusSessions.trackId,
      startedAt: focusSessions.startedAt,
      pausedMs: focusSessions.pausedMs,
      pausedAt: focusSessions.pausedAt,
      lastHeartbeatAt: focusSessions.lastHeartbeatAt,
    })
    .from(focusSessions)
    .where(and(inArray(focusSessions.userId, sharing), isNull(focusSessions.endedAt)));

  const live = new Map<string, LiveStatus>();
  for (const row of rows) {
    // An abandoned timer is not "studying now", even before the reaper runs.
    if (!isHeartbeatFresh(row.lastHeartbeatAt, now)) continue;
    const track = trackLabels.get(row.trackId);
    live.set(row.userId, {
      startedAt: row.startedAt,
      pausedMs: row.pausedMs,
      pausedAt: row.pausedAt,
      trackLabel: track?.title ?? "a track",
      trackColor: track?.color ?? "teal",
    });
  }
  return live;
}

/** Track labels as each person's friends may see them, keyed by track id. */
function visibleTrackLabels(
  trackRows: Awaited<ReturnType<typeof loadTracks>>,
  settings: Map<string, SharingSettings>,
  viewerId: string,
): Map<string, { title: string; color: string }> {
  const byUser = new Map<string, typeof trackRows>();
  for (const t of trackRows) byUser.set(t.userId, [...(byUser.get(t.userId) ?? []), t]);

  const labels = new Map<string, { title: string; color: string }>();
  for (const [userId, list] of byUser) {
    // You always see your own names.
    const share = userId === viewerId || (settings.get(userId)?.shareTrackNames ?? false);
    for (const t of redactTrackTitles(list, share)) labels.set(t.id, { title: t.title, color: t.color });
  }
  return labels;
}

export async function getFriendsOverview(): Promise<FriendsOverview> {
  const viewer = await requireUser();
  const now = Date.now();

  const rows = await db
    .select({
      id: friendships.id,
      status: friendships.status,
      requesterId: friendships.requesterId,
      createdAt: friendships.createdAt,
      other: personColumns,
    })
    .from(friendships)
    .innerJoin(
      users,
      sql`${users.id} = case when ${friendships.requesterId} = ${viewer.id} then ${friendships.addresseeId} else ${friendships.requesterId} end`,
    )
    .where(or(eq(friendships.requesterId, viewer.id), eq(friendships.addresseeId, viewer.id)))
    .orderBy(desc(friendships.createdAt));

  const accepted = rows.filter((r) => r.status === "accepted");
  const incoming = rows.filter((r) => r.status === "pending" && r.requesterId !== viewer.id);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requesterId === viewer.id);

  const ids = [viewer.id, ...accepted.map((r) => r.other.id)];
  // A year and a bit back: enough for any streak the overview shows.
  const since = new Date(now - 380 * 86_400_000);
  const [settings, sessionRows, trackRows] = await Promise.all([
    loadSettings(ids),
    loadFinishedSessions(ids, since),
    loadTracks(ids),
  ]);
  const labels = visibleTrackLabels(trackRows, settings, viewer.id);
  const live = await loadLive(
    accepted.map((r) => r.other.id),
    settings,
    labels,
    now,
  );

  const sessionsByUser = new Map<string, SplittableSession[]>();
  for (const s of sessionRows) {
    sessionsByUser.set(s.userId, [...(sessionsByUser.get(s.userId) ?? []), s]);
  }

  const card = (person: Person, isSelf: boolean): FriendCard => {
    const summary = computeFocusSummary({
      settings: settings.get(person.id) ?? FALLBACK_SETTINGS,
      now,
      sessions: sessionsByUser.get(person.id) ?? [],
    });
    return {
      ...person,
      isSelf,
      todayMs: summary.todayMs,
      weekMs: summary.weekMs,
      streak: summary.streaks.current,
      live: isSelf ? null : (live.get(person.id) ?? null),
    };
  };

  const toRequest = (r: (typeof rows)[number]): FriendRequest => ({
    id: r.id,
    person: toPerson(r.other),
    createdAt: r.createdAt,
  });

  return {
    people: [
      card(
        toPerson({
          id: viewer.id,
          name: viewer.name,
          email: viewer.email,
          image: viewer.image,
          username: (await getMyProfile()).username,
        }),
        true,
      ),
      ...accepted.map((r) => card(toPerson(r.other), false)),
    ],
    incoming: incoming.map(toRequest),
    outgoing: outgoing.map(toRequest),
  };
}

/** The gate. Returns the friend only if the viewer and they are accepted friends. */
async function acceptedFriend(viewerId: string, friendId: string): Promise<Person | null> {
  if (viewerId === friendId) return null;
  const [row] = await db
    .select(personColumns)
    .from(friendships)
    .innerJoin(users, eq(users.id, friendId))
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, viewerId), eq(friendships.addresseeId, friendId)),
          and(eq(friendships.requesterId, friendId), eq(friendships.addresseeId, viewerId)),
        ),
      ),
    )
    .limit(1);
  return row ? toPerson(row) : null;
}

export type FriendProfile = {
  person: Person;
  data: AnalyticsData;
  live: LiveStatus | null;
  sharesTrackNames: boolean;
};

export async function getFriendProfile(
  friendId: string,
  rangeKey: AnalyticsRangeKey,
): Promise<FriendProfile | null> {
  const viewer = await requireUser();
  const person = await acceptedFriend(viewer.id, friendId);
  if (!person) return null;

  const now = Date.now();
  const settings = (await loadSettings([friendId])).get(friendId) ?? FALLBACK_SETTINGS;

  // Same window the analytics page loads for its owner, in the friend's zone.
  const { earliest } = analyticsWindow(rangeKey, settings, now);
  const from = zonedInstant(addDays(earliest, -1), null, settings.timeZone);

  const [sessionRows, trackRows] = await Promise.all([
    loadFinishedSessions([friendId], from),
    loadTracks([friendId]),
  ]);
  const visible = redactTrackTitles(trackRows, settings.shareTrackNames);
  const labels = new Map(visible.map((t) => [t.id, { title: t.title, color: t.color }]));
  const live = (await loadLive([friendId], new Map([[friendId, settings]]), labels, now)).get(friendId) ?? null;

  return {
    person,
    data: computeAnalytics({
      rangeKey,
      settings,
      now,
      sessions: sessionRows,
      tracks: visible,
      // Tasks are never shared.
      tasks: [],
      perspective: "friend",
    }),
    live,
    sharesTrackNames: settings.shareTrackNames,
  };
}

/** The viewer's own sharing switches, for the Settings page. */
export async function getMySharing(): Promise<{ shareTrackNames: boolean; shareLiveStatus: boolean }> {
  const viewer = await requireUser();
  const s = (await loadSettings([viewer.id])).get(viewer.id) ?? FALLBACK_SETTINGS;
  return { shareTrackNames: s.shareTrackNames, shareLiveStatus: s.shareLiveStatus };
}

export type MyProfile = {
  username: string | null;
  /** The chosen animal id, or null for the Google photo. */
  avatar: string | null;
  /** The Google photo itself, for the picker's "photo" option. */
  photo: string | null;
};

/** Your username and avatar choice, for Settings. */
export async function getMyProfile(): Promise<MyProfile> {
  const viewer = await requireUser();
  const [row] = await db
    .select({ username: users.username, avatar: users.avatar, photo: users.image })
    .from(users)
    .where(eq(users.id, viewer.id))
    .limit(1);
  return row ?? { username: null, avatar: null, photo: null };
}
