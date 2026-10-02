"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { MAX_TAGS, normalizeTags } from "@/features/sessions/lib/tags";
import { cn } from "@/lib/utils";

/**
 * Chips plus a text box. Enter or a comma adds what you typed; Backspace in
 * an empty box removes the last tag; your most-used tags are one click away.
 */
export function TagInput({
  id,
  value,
  onChange,
  suggestions = [],
  className,
}: {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  /** Most used first. */
  suggestions?: string[];
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const full = value.length >= MAX_TAGS;

  function add(raw: string) {
    const next = normalizeTags([...value, raw]).slice(0, MAX_TAGS);
    onChange(next);
    setDraft("");
  }

  const query = draft.trim().toLowerCase();
  const offered = suggestions
    .filter((tag) => !value.includes(tag) && (!query || tag.includes(query)))
    .slice(0, 6);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "border-input focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 focus-within:ring-[3px]",
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs"
          >
            {tag}
            <button
              type="button"
              className="hover:text-foreground text-muted-foreground cursor-pointer rounded"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={full}
          onChange={(e) => {
            const text = e.target.value;
            // A typed comma commits the tag before it.
            if (text.includes(",")) add(text);
            else setDraft(text);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={full ? `Up to ${MAX_TAGS} tags` : value.length ? "" : "lecture, practice…"}
          className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
          aria-describedby={`${id}-hint`}
        />
      </div>
      {!full && offered.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Your tags">
          {offered.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="text-muted-foreground hover:text-foreground hover:border-foreground/30 inline-flex cursor-pointer items-center gap-0.5 rounded-md border border-dashed px-1.5 py-0.5 text-xs transition-colors"
            >
              <Plus className="size-3" aria-hidden />
              {tag}
            </button>
          ))}
        </div>
      ) : null}
      <p id={`${id}-hint`} className="sr-only">
        Press Enter or type a comma to add a tag. Backspace removes the last one.
      </p>
    </div>
  );
}
