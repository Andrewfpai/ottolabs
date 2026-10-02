/**
 * Everything you have put into the app, in formats you can take elsewhere.
 *
 * JSON is the complete record (every table, every column that is yours);
 * the CSVs are the two things you would actually open in a spreadsheet, with
 * local-time columns added so nobody has to convert UTC by hand. User ids and
 * Auth.js tables are never included.
 */
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { focusSessions, tasks, tracks } from "@/db/schema";
import { requireSettings, requireUser } from "@/lib/auth-guard";
import { dayKey, focusDayKey, timeOfDay } from "@/lib/time/calendar-day";
import { elapsedMs, MINUTE_MS } from "@/lib/time/elapsed";
import { toCsv } from "@/lib/csv";

export const EXPORT_KINDS = ["json", "sessions.csv", "tasks.csv"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export type ExportFile = { filename: string; contentType: string; body: string };

const minutes = (ms: number) => Math.round((ms / MINUTE_MS) * 10) / 10;

async function load() {
  const user = await requireUser();
  const settings = await requireSettings();

  const [trackRows, sessionRows, taskRows] = await Promise.all([
    db.select().from(tracks).where(eq(tracks.userId, user.id)).orderBy(asc(tracks.createdAt)),
    db
      .select({ session: focusSessions, trackTitle: tracks.title })
      .from(focusSessions)
      .innerJoin(tracks, eq(tracks.id, focusSessions.trackId))
      .where(eq(focusSessions.userId, user.id))
      .orderBy(asc(focusSessions.startedAt)),
    db
      .select({ task: tasks, trackTitle: tracks.title })
      .from(tasks)
      .leftJoin(tracks, eq(tracks.id, tasks.trackId))
      .where(eq(tasks.userId, user.id))
      .orderBy(asc(tasks.createdAt)),
  ]);

  return { settings, trackRows, sessionRows, taskRows };
}

export async function buildExport(kind: ExportKind): Promise<ExportFile> {
  const { settings, trackRows, sessionRows, taskRows } = await load();
  const tz = settings.timezone;
  const now = Date.now();
  const stamp = dayKey(now, tz);

  if (kind === "sessions.csv") {
    return {
      filename: `ottolabs-sessions-${stamp}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: toCsv(
        [
          "id",
          "track",
          "focus_day",
          "local_start",
          "started_at_utc",
          "ended_at_utc",
          "focus_minutes",
          "paused_minutes",
          "break_minutes",
          "mode",
          "pomodoro_cycles",
          "end_reason",
          "note",
          "tags",
        ],
        sessionRows.map(({ session: s, trackTitle }) => [
          s.id,
          trackTitle,
          focusDayKey(s.startedAt, tz, settings.dayStartHour),
          timeOfDay(s.startedAt, tz),
          s.startedAt.toISOString(),
          s.endedAt?.toISOString() ?? "",
          minutes(elapsedMs(s, now)),
          minutes(s.pausedMs),
          minutes(s.breakMs),
          s.mode,
          s.completedCycles,
          s.endReason ?? (s.endedAt ? "" : "running"),
          s.note,
          s.tags.join("; "),
        ]),
      ),
    };
  }

  if (kind === "tasks.csv") {
    return {
      filename: `ottolabs-tasks-${stamp}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: toCsv(
        [
          "id",
          "title",
          "track",
          "status",
          "priority",
          "due_date",
          "due_time",
          "due_at_utc",
          "completed_at_utc",
          "created_at_utc",
          "notes",
        ],
        taskRows.map(({ task: t, trackTitle }) => [
          t.id,
          t.title,
          trackTitle,
          t.status,
          t.priority,
          t.dueAt ? dayKey(t.dueAt, tz) : "",
          t.dueAt && !t.isAllDay ? timeOfDay(t.dueAt, tz) : "",
          t.dueAt?.toISOString() ?? "",
          t.completedAt?.toISOString() ?? "",
          t.createdAt.toISOString(),
          t.notes,
        ]),
      ),
    };
  }

  // Strip ownership columns: the export is about your data, not our keys.
  const withoutUser = <T extends { userId: string }>(row: T): Omit<T, "userId"> => {
    const copy: Partial<T> = { ...row };
    delete copy.userId;
    return copy as Omit<T, "userId">;
  };

  return {
    filename: `ottolabs-export-${stamp}.json`,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(
      {
        app: "OttoLabs",
        formatVersion: 1,
        exportedAt: new Date(now).toISOString(),
        settings: withoutUser(settings),
        tracks: trackRows.map(withoutUser),
        sessions: sessionRows.map(({ session }) => ({
          ...withoutUser(session),
          // Derived, for convenience; the timestamps above are the record.
          focusMs: elapsedMs(session, now),
        })),
        tasks: taskRows.map(({ task }) => withoutUser(task)),
      },
      null,
      2,
    ),
  };
}
