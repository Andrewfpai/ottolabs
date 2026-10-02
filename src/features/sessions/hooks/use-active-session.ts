"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import type { SessionWithTrack } from "@/features/sessions/server/queries";
import {
  discardSession,
  finishSession,
  pauseSession,
  resumeSession,
  startBreak,
  startSession,
  trimIdleTime,
} from "@/features/sessions/server/actions";

export const ACTIVE_SESSION_KEY = ["session", "active"] as const;

/** Sent while a timer is live. Must stay well under the reaper's 30-minute cut-off. */
const HEARTBEAT_INTERVAL_MS = 60_000;

type ActiveSessionResponse = {
  session: SessionWithTrack | null;
  serverNow: number;
};

async function fetchActiveSession(): Promise<SessionWithTrack | null> {
  const res = await fetch("/api/sessions/active", { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Could not load the running timer (${res.status})`);

  const body = (await res.json()) as ActiveSessionResponse;
  return body.session;
}

export function useActiveSession(initial?: SessionWithTrack | null) {
  return useQuery({
    queryKey: ACTIVE_SESSION_KEY,
    queryFn: fetchActiveSession,
    initialData: initial,
    // The running timer is the one piece of state a second tab, or the reaper,
    // can change behind your back. Refetching on focus is what stops two tabs
    // from disagreeing about whether a timer is still going.
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

/**
 * Tells the server "still here" once a minute while a timer is live.
 *
 * Runs while paused as well as while running: a deliberate 40-minute break with
 * the tab open is you still being present, and should not be reaped.
 */
export function useHeartbeat(session: SessionWithTrack | null | undefined) {
  const queryClient = useQueryClient();
  const sessionId = session?.id ?? null;

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    const beat = async () => {
      try {
        const res = await fetch("/api/sessions/heartbeat", { method: "POST" });
        // 409 means the server no longer has a live session — stopped in
        // another tab, or reaped. Stop pretending it is running.
        if (res.status === 409 && !cancelled) {
          void queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
        }
      } catch {
        // Offline or asleep. The next beat will either succeed or the reaper
        // will close the session at this last known heartbeat, which is the
        // correct outcome either way.
      }
    };

    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    // Coming back to the tab is exactly when the session is most likely to have
    // been reaped or stopped elsewhere, so beat immediately on return.
    const onVisible = () => {
      if (document.visibilityState === "visible") void beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId, queryClient]);
}

function useSessionMutation<TInput, TOutput>(
  fn: (input: TInput) => Promise<
    { ok: true; data: TOutput } | { ok: false; error: string; code?: string }
  >,
  options?: { onSuccess?: (data: TOutput) => void; successToast?: string },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TInput) => {
      const result = await fn(input);
      if (!result.ok) throw Object.assign(new Error(result.error), { code: result.code });
      return result.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
      if (options?.successToast) toast.success(options.successToast);
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      // Whatever went wrong, the server is the authority on what is running.
      void queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
    },
  });
}

export function useStartSession() {
  return useSessionMutation(startSession);
}

export function usePauseSession() {
  return useSessionMutation(pauseSession);
}

export function useResumeSession() {
  return useSessionMutation(resumeSession);
}

/** Work interval over — begin the break. Driven by `usePomodoroEngine`. */
export function useStartBreak() {
  return useSessionMutation(startBreak);
}

/** Bank a stretch you were away for as paused time, keeping the timer running. */
export function useTrimIdleTime() {
  return useSessionMutation(trimIdleTime, {
    successToast: "Trimmed the time you were away.",
  });
}

export function useFinishSession() {
  return useSessionMutation(finishSession);
}

export function useDiscardSession() {
  return useSessionMutation(discardSession, {
    successToast: "Session discarded.",
  });
}
