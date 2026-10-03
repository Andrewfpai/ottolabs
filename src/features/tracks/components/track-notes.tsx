import { NotebookPen } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DeleteSessionButton } from "@/features/sessions/components/delete-session";
import type { TrackNote } from "@/features/tracks/server/queries";
import { dayKey, formatDayKey, timeOfDay } from "@/lib/time/calendar-day";
import { elapsedMs, formatCompact } from "@/lib/time/elapsed";

/**
 * What you wrote when you finished each session, read back in order. The
 * "what did you actually do?" prompt is only worth answering if the answers
 * come back somewhere.
 */
export function TrackNotes({
  notes,
  total,
  page,
  pageSize,
  timeZone,
  hrefForPage,
}: {
  notes: TrackNote[];
  total: number;
  page: number;
  pageSize: number;
  timeZone: string;
  hrefForPage: (page: number) => string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section aria-labelledby="track-notes" className="bg-card rounded-xl border">
      <div className="border-b px-4 py-3 sm:px-5">
        <h2 id="track-notes" className="text-sm font-medium">
          Notes <span className="text-muted-foreground font-normal">{total}</span>
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">Newest first: what you wrote when you finished.</p>
      </div>

      {notes.length === 0 ? (
        <div className="text-muted-foreground flex items-start gap-2 px-4 py-6 text-sm sm:px-5">
          <NotebookPen className="mt-0.5 size-4 shrink-0" aria-hidden />
          No notes on this track yet. When you finish a session, jot down what you did and it will
          show up here.
        </div>
      ) : (
        <ol className="divide-y">
          {notes.map((note) => {
            const key = dayKey(note.startedAt, timeZone);
            return (
              <li key={note.id} className="flex gap-2 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="text-foreground font-medium">
                    {formatDayKey(key, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="tabular">{timeOfDay(note.startedAt, timeZone)}</span>
                  <span>·</span>
                  <span className="tabular">{formatCompact(elapsedMs(note))}</span>
                </div>
                {note.note ? (
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{note.note}</p>
                ) : null}
                {note.tags.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {note.tags.map((tag) => (
                      <span key={tag} className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                </div>
                <DeleteSessionButton
                  sessionId={note.id}
                  summary={`${formatCompact(elapsedMs(note))} on ${formatDayKey(key, { weekday: "short", day: "numeric", month: "short" })}`}
                />
              </li>
            );
          })}
        </ol>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Notes pages" className="flex items-center justify-between border-t px-4 py-2.5 sm:px-5">
          <Button variant="ghost" size="sm" asChild={page > 1} disabled={page <= 1} className="cursor-pointer">
            {page > 1 ? <Link href={hrefForPage(page - 1)} scroll={false}>Newer</Link> : <span>Newer</span>}
          </Button>
          <span className="text-muted-foreground text-xs">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            asChild={page < pageCount}
            disabled={page >= pageCount}
            className="cursor-pointer"
          >
            {page < pageCount ? (
              <Link href={hrefForPage(page + 1)} scroll={false}>
                Older
              </Link>
            ) : (
              <span>Older</span>
            )}
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
