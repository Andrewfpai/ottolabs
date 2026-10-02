"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hasFilters, MAX_QUERY_LENGTH, type SessionFilters, sessionsHref } from "@/features/sessions/lib/filters";
import type { TrackOption } from "@/features/tracks/server/queries";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

const ALL = "all";

/**
 * One row of filters above the log. Every change goes into the URL and the
 * server renders the result, so the page, its count and its pagination always
 * describe the same slice.
 */
export function SessionFiltersBar({
  filters,
  tracks,
  tags,
}: {
  filters: SessionFilters;
  tracks: TrackOption[];
  tags: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");

  function apply(next: SessionFilters) {
    // Any change starts again from the first page.
    startTransition(() => router.replace(sessionsHref(next), { scroll: false }));
  }

  // A tag in the URL that is not in your list (typed by hand) stays selectable.
  const tagOptions = filters.tag && !tags.includes(filters.tag) ? [filters.tag, ...tags] : tags;

  return (
    <div
      className={cn("mb-4 flex flex-col gap-2 transition-opacity lg:flex-row lg:items-center", pending && "opacity-60")}
      aria-busy={pending}
    >
      <form
        role="search"
        className="relative lg:w-64"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ ...filters, q: q.trim() || undefined });
        }}
      >
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Search notes, then Enter"
          aria-label="Search session notes"
          className="pl-8"
        />
      </form>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select
          value={filters.track ?? ALL}
          onValueChange={(value) => apply({ ...filters, track: value === ALL ? undefined : value })}
        >
          <SelectTrigger aria-label="Filter by track" className="w-full cursor-pointer sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="cursor-pointer">
              All tracks
            </SelectItem>
            {tracks.length > 0 ? <SelectSeparator /> : null}
            {tracks.map((track) => (
              <SelectItem key={track.id} value={track.id} className="cursor-pointer">
                <span aria-hidden className={cn("size-2 rounded-full", trackColorClasses(track.color).bg)} />
                {track.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.tag ?? ALL}
          onValueChange={(value) => apply({ ...filters, tag: value === ALL ? undefined : value })}
          disabled={tagOptions.length === 0}
        >
          <SelectTrigger aria-label="Filter by tag" className="w-full cursor-pointer sm:w-40">
            <SelectValue placeholder="No tags yet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="cursor-pointer">
              All tags
            </SelectItem>
            {tagOptions.length > 0 ? <SelectSeparator /> : null}
            {tagOptions.map((tag) => (
              <SelectItem key={tag} value={tag} className="cursor-pointer">
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          aria-label="From date"
          value={filters.from ?? ""}
          max={filters.to}
          onChange={(e) => apply({ ...filters, from: e.target.value || undefined })}
          className="tabular w-full cursor-pointer sm:w-40"
        />
        <Input
          type="date"
          aria-label="To date"
          value={filters.to ?? ""}
          min={filters.from}
          onChange={(e) => apply({ ...filters, to: e.target.value || undefined })}
          className="tabular w-full cursor-pointer sm:w-40"
        />
      </div>

      {hasFilters(filters) ? (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer gap-1 self-start lg:self-auto"
          onClick={() => {
            setQ("");
            apply({});
          }}
        >
          <X className="size-3.5" aria-hidden />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
