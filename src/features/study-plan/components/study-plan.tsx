"use client";

import { ArrowDown, ArrowUp, ListChecks, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TrackUnit } from "@/db/schema";
import {
  MAX_UNIT_TITLE,
  parseUnitTitles,
  planProgress,
  pluralUnit,
  progressLabel,
  UNIT_LABELS,
} from "@/features/study-plan/lib/plan";
import {
  addUnits,
  deleteUnit,
  moveUnit,
  renameUnit,
  setUnitDone,
  setUnitLabel,
} from "@/features/study-plan/server/actions";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; error?: string };

function useAct() {
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<Result>, success?: string) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error ?? "That did not work.");
      else if (success) toast.success(success);
    });
  return { pending, act };
}

export function StudyPlan({
  trackId,
  label,
  units,
}: {
  trackId: string;
  label: string;
  units: TrackUnit[];
}) {
  const progress = planProgress(units);
  const where = progressLabel(label, progress);
  const { pending, act } = useAct();

  return (
    <section aria-labelledby="study-plan" className="bg-card rounded-xl border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id="study-plan" className="text-sm font-medium">
            Study plan
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {progress.total === 0
              ? `Break the track into ${pluralUnit(label)} and tick them off as you go.`
              : `${where} · ${progress.done} of ${progress.total} done`}
          </p>
        </div>
        <Select
          value={label}
          onValueChange={(value) => act(() => setUnitLabel({ trackId, label: value }))}
          disabled={pending}
        >
          <SelectTrigger aria-label="What the plan's parts are called" className="h-8 w-32 cursor-pointer text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIT_LABELS.map((option) => (
              <SelectItem key={option} value={option} className="cursor-pointer">
                {pluralUnit(option).replace(/^./, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {progress.total > 0 ? (
        <>
          <div
            className="bg-muted mx-4 mt-3 h-1.5 overflow-hidden rounded-full sm:mx-5"
            role="progressbar"
            aria-label="Study plan progress"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          >
            <div
              className="bg-primary h-full rounded-full motion-safe:transition-[width]"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <ol className="divide-y py-1">
            {units.map((unit, index) => (
              <UnitRow
                key={unit.id}
                unit={unit}
                number={index + 1}
                label={label}
                isNext={index === progress.nextIndex}
                isFirst={index === 0}
                isLast={index === units.length - 1}
              />
            ))}
          </ol>
        </>
      ) : null}

      <AddUnits trackId={trackId} label={label} empty={progress.total === 0} />
    </section>
  );
}

function UnitRow({
  unit,
  number,
  label,
  isNext,
  isFirst,
  isLast,
}: {
  unit: TrackUnit;
  number: number;
  label: string;
  isNext: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { pending, act } = useAct();
  const [, startDone] = useTransition();
  // Ticks instantly; the server confirms a moment later.
  const [done, setOptimisticDone] = useOptimistic(unit.completedAt !== null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(unit.title);
  const name = `${label} ${number}`;

  function toggle() {
    const next = !done;
    startDone(async () => {
      setOptimisticDone(next);
      const result = await setUnitDone({ id: unit.id, done: next });
      if (!result.ok) toast.error(result.error);
    });
  }

  function save() {
    const title = draft.trim();
    setEditing(false);
    if (!title || title === unit.title) {
      setDraft(unit.title);
      return;
    }
    act(() => renameUnit({ id: unit.id, title }));
  }

  return (
    <li className={cn("group flex items-center gap-3 px-4 py-2 sm:px-5", isNext && "bg-primary/5")}>
      <Checkbox
        checked={done}
        onCheckedChange={toggle}
        aria-label={done ? `Mark ${name} as not done` : `Mark ${name} as done`}
        className="cursor-pointer"
      />
      {/* The full "Chapter 6" where there is room; just "6." on a phone, so the title gets the width. */}
      <span className="text-muted-foreground tabular w-6 shrink-0 text-xs sm:w-20">
        <span className="sm:hidden" aria-hidden>
          {number}.
        </span>
        <span className="max-sm:sr-only">{name}</span>
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            value={draft}
            autoFocus
            maxLength={MAX_UNIT_TITLE}
            aria-label={`Rename ${name}`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraft(unit.title);
                setEditing(false);
              }
            }}
            className="h-8"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              "block w-full cursor-pointer truncate text-left text-sm",
              done && "text-muted-foreground line-through",
            )}
            title="Click to rename"
          >
            {unit.title}
          </button>
        )}
      </div>
      {isNext ? (
        <Badge variant="secondary" className="shrink-0 text-xs">
          Up next
        </Badge>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={pending}
            className="text-muted-foreground size-8 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-sm:opacity-100"
            aria-label={`Actions for ${name}`}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="cursor-pointer gap-2" onSelect={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            disabled={isFirst}
            onSelect={() => act(() => moveUnit({ id: unit.id, direction: "up" }))}
          >
            <ArrowUp className="size-4" aria-hidden />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            disabled={isLast}
            onSelect={() => act(() => moveUnit({ id: unit.id, direction: "down" }))}
          >
            <ArrowDown className="size-4" aria-hidden />
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer gap-2"
            onSelect={() => act(() => deleteUnit({ id: unit.id }), `${name} removed.`)}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function AddUnits({ trackId, label, empty }: { trackId: string; label: string; empty: boolean }) {
  const [open, setOpen] = useState(empty);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const count = parseUnitTitles(text).length;
  const plural = pluralUnit(label);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (count === 0) return;
    start(async () => {
      const result = await addUnits({ trackId, text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setText("");
      toast.success(`Added ${result.data} ${result.data === 1 ? label.toLowerCase() : plural}.`);
    });
  }

  if (!open) {
    return (
      <div className="border-t px-4 py-2.5 sm:px-5">
        <Button variant="ghost" size="sm" className="-ml-2 cursor-pointer gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Add {plural}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn("space-y-2 px-4 py-3 sm:px-5", !empty && "border-t")}>
      <Label htmlFor={`add-units-${trackId}`} className="flex items-center gap-1.5">
        <ListChecks className="size-4" aria-hidden />
        Add {plural}, one per line
      </Label>
      <Textarea
        id={`add-units-${trackId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={empty ? 6 : 3}
        placeholder={"Paste a table of contents, or type:\nIntroduction\nThe relational model\nIndexes and B-trees"}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" className="cursor-pointer" disabled={pending || count === 0} aria-busy={pending}>
          {count > 0 ? `Add ${count} ${count === 1 ? label.toLowerCase() : plural}` : `Add ${plural}`}
        </Button>
        {!empty ? (
          <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
        <span className="text-muted-foreground text-xs">Numbers and bullets at the start of lines are removed.</span>
      </div>
    </form>
  );
}
