"use client";

import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ACTIVE_SESSION_KEY } from "@/features/sessions/hooks/use-active-session";
import { saveLiveNote } from "@/features/sessions/server/actions";
import type { SessionWithTrack } from "@/features/sessions/server/queries";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * A note pad over focus mode, written straight into the running session's
 * note. Saves a moment after you stop typing; the finish dialog opens with it.
 */
export function SessionNotes({ session, onClose }: { session: SessionWithTrack; onClose: () => void }) {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState(session.note ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(text);

  function save(value: string) {
    setState("saving");
    void saveLiveNote({ id: session.id, note: value }).then((result) => {
      // A newer keystroke has already queued its own save.
      if (latest.current !== value) return;
      if (!result.ok) {
        setState("error");
        return;
      }
      setState("saved");
      // Keep the cached session in step, so the finish dialog starts from it.
      queryClient.setQueryData<SessionWithTrack | null>(ACTIVE_SESSION_KEY, (old) =>
        old && old.id === session.id ? { ...old, note: value.trim() ? value : null } : old,
      );
    });
  }

  function change(value: string) {
    setText(value);
    latest.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(value), 700);
  }

  // Closing mid-typing still saves what was typed.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void saveLiveNote({ id: session.id, note: latest.current });
      }
    },
    [session.id],
  );

  return (
    <motion.section
      aria-label="Session notes"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute right-4 bottom-24 z-10 flex w-[min(22rem,calc(100vw-2rem))] flex-col rounded-2xl border border-white/15 bg-black/55 p-3 text-white shadow-2xl backdrop-blur-md sm:top-20 sm:bottom-auto"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">Notes for this session</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notes"
          className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => change(e.target.value)}
        maxLength={2000}
        rows={8}
        autoFocus
        placeholder="What are you working through? Questions to look up later?"
        className="min-h-40 w-full resize-y rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
      />
      <p className="mt-1.5 text-xs text-white/60" aria-live="polite">
        {state === "saving"
          ? "Saving…"
          : state === "saved"
            ? "Saved to this session"
            : state === "error"
              ? "Could not save. Your text is still here."
              : "Saved with the session when you finish."}
      </p>
    </motion.section>
  );
}
