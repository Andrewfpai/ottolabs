"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Coffee,
  Contact,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  NotebookPen,
  Palette,
  Pause,
  Play,
  Square,
  Timer,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Track } from "@/db/schema";
import { BackgroundPicker } from "@/features/focus/components/background-picker";
import { FocusBackground } from "@/features/focus/components/focus-background";
import { FriendsPanel } from "@/features/focus/components/friends-panel";
import { RoomPanel } from "@/features/focus/components/room-panel";
import type { FriendCard } from "@/features/friends/server/queries";
import { SessionNotes } from "@/features/focus/components/session-notes";
import { StudyTogether } from "@/features/focus/components/study-together";
import type { MyRoom, RoomInvitation } from "@/features/rooms/server/queries";
import { FinishSessionDialog } from "@/features/sessions/components/finish-session-dialog";
import {
  useActiveSession,
  useDiscardSession,
  usePauseSession,
  useResumeSession,
  useStartSession,
} from "@/features/sessions/hooks/use-active-session";
import { useElapsed } from "@/features/sessions/hooks/use-elapsed";
import { usePomodoroPhase } from "@/features/sessions/hooks/use-pomodoro";
import { formatCountdown, phaseLabel } from "@/features/sessions/lib/pomodoro";
import { TIMER_LAYOUT_ID } from "@/features/sessions/lib/timer-layout";
import type { SessionWithTrack } from "@/features/sessions/server/queries";
import { FocusSoundButton } from "@/features/sounds/components/focus-sound-picker";
import type { TrackTask } from "@/features/tasks/server/queries";
import { formatCompact, formatDuration, timerState } from "@/lib/time/elapsed";
import { cn } from "@/lib/utils";

/** Glassy controls that read on any background, scene or photo. */
const GLASS =
  "border border-white/15 bg-black/35 text-white backdrop-blur-md hover:bg-black/55 hover:text-white focus-visible:ring-white/60";

function GlassIcon({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn("size-10 cursor-pointer rounded-xl", GLASS, active && "bg-white/25")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const noop = () => () => {};

/** Whether the page is in browser fullscreen, kept in step with Esc and F11. */
function useFullscreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);
  // Read after hydration only: the server cannot know (iPhone Safari says no).
  const supported = useSyncExternalStore(
    noop,
    () => Boolean(document.fullscreenEnabled),
    () => false,
  );
  return { on, toggle, supported };
}

/**
 * Focus mode: the running timer over a full-screen scene.
 *
 * The toolbar picks the background, opens notes, studies together, sets
 * focus sounds and goes fullscreen; the bottom bar pauses and finishes. With
 * nothing running it offers to start, so the screen works as a place to
 * begin as well as to continue.
 *
 * Note this does NOT run the Pomodoro engine or the heartbeat. Those live in
 * the timer bar, which stays mounted underneath (AGENTS rule 13).
 */
export function FocusScreen({
  initial,
  tracks,
  tasksByTrack,
  rooms,
  initialTrackId,
  friends,
  invitations,
}: {
  initial: SessionWithTrack | null;
  tracks: Track[];
  tasksByTrack: Record<string, TrackTask[]>;
  rooms: MyRoom[];
  initialTrackId?: string;
  friends: FriendCard[];
  invitations: RoomInvitation[];
}) {
  const { data: session } = useActiveSession(initial);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const fullscreen = useFullscreen();

  const [finishOpen, setFinishOpen] = useState(false);
  const [frozenMs, setFrozenMs] = useState(0);
  const [panel, setPanel] = useState<"background" | "together" | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  // Open by default when a friend is studying or an invitation is waiting.
  // In a room, the room panel shows by default; Study together reopens it.
  const [roomOpen, setRoomOpen] = useState(true);
  const [friendsOpen, setFriendsOpen] = useState(() => invitations.length > 0 || friends.some((f) => f.live));
  const [hidden, setHidden] = useState(false);
  const [pictureVersion, setPictureVersion] = useState(0);

  const elapsed = useElapsed(session);
  const phase = usePomodoroPhase(session);

  // The readout morphs from the timer bar's; omitting the id opts out.
  const readoutId = reduceMotion ? undefined : TIMER_LAYOUT_ID.readout;

  const pause = usePauseSession();
  const resume = useResumeSession();
  const discard = useDiscardSession();

  const state = session ? timerState(session) : "ended";
  const isPaused = state === "paused";
  const onBreak = phase != null && phase.kind !== "work";
  const busy = pause.isPending || resume.isPending;

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    // Typing /focus straight into the address bar leaves nothing to go back to.
    if (window.history.length > 1) router.back();
    else router.push("/dashboard");
  }, [router]);

  const toggle = useCallback(() => {
    if (!session || busy) return;
    if (isPaused) resume.mutate({ id: session.id });
    else pause.mutate({ id: session.id });
  }, [session, busy, isPaused, pause, resume]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (finishOpen || panel) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable], [role=dialog]")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        if (hidden) setHidden(false);
        else exit();
      }
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exit, toggle, finishOpen, panel, hidden]);


  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-white">
      <FocusBackground version={pictureVersion} />

      <div className="relative flex h-full flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Top: way out on the left, tools on the right. */}
        <div className={cn("flex items-start justify-between gap-3 p-4 transition-opacity", hidden && "pointer-events-none opacity-0")}>
          <GlassIcon label="Exit focus mode" onClick={exit}>
            <ArrowLeft className="size-4" aria-hidden />
          </GlassIcon>
          <div className="flex flex-wrap justify-end gap-2">
            <GlassIcon label="Background" onClick={() => setPanel("background")}>
              <Palette className="size-4" aria-hidden />
            </GlassIcon>
            {session ? (
              <GlassIcon label="Session notes" active={notesOpen} onClick={() => setNotesOpen((o) => !o)}>
                <NotebookPen className="size-4" aria-hidden />
              </GlassIcon>
            ) : null}
            <GlassIcon label="Friends" active={friendsOpen} onClick={() => setFriendsOpen((o) => !o)}>
              <span className="relative">
                <Contact className="size-4" aria-hidden />
                {invitations.length > 0 || friends.some((f) => f.live) ? (
                  <span aria-hidden className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-400" />
                ) : null}
              </span>
            </GlassIcon>
            <GlassIcon
              label="Study together"
              active={Boolean(session?.roomId)}
              onClick={() => {
                if (session?.roomId && !roomOpen) setRoomOpen(true);
                else setPanel("together");
              }}
            >
              <Users className="size-4" aria-hidden />
            </GlassIcon>
            <FocusSoundButton audibleNow={Boolean(session) && !isPaused} className={cn("size-10 rounded-xl", GLASS)} />
            {fullscreen.supported ? (
              <GlassIcon label={fullscreen.on ? "Leave fullscreen" : "Fullscreen"} onClick={fullscreen.toggle}>
                {fullscreen.on ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
              </GlassIcon>
            ) : null}
            <GlassIcon label="Hide controls" onClick={() => setHidden(true)}>
              <EyeOff className="size-4" aria-hidden />
            </GlassIcon>
          </div>
        </div>

        {/* Centre: what you are on, and the number. */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center [text-shadow:0_2px_16px_rgba(0,0,0,0.45)]">
          {session ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-4xl">{session.track.title}</h1>
              {session.task ? <p className="-mt-1 text-sm text-white/80 sm:text-base">{session.task.title}</p> : null}
              {phase ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium backdrop-blur",
                    onBreak ? "bg-white/15 text-white" : "bg-black/30 text-white",
                  )}
                >
                  {onBreak ? <Coffee className="size-3.5" aria-hidden /> : <Timer className="size-3.5" aria-hidden />}
                  {phaseLabel(phase)}
                  {phase.completedCycles > 0 ? <span className="text-white/70">· {phase.completedCycles} done</span> : null}
                </span>
              ) : null}
              {/* A live clock: the server's render is a second or so older than the browser's. */}
              <motion.p
                suppressHydrationWarning
                layoutId={readoutId}
                className={cn(
                  "font-numeric mt-2 text-7xl leading-none font-semibold tabular-nums sm:text-9xl",
                  isPaused && !onBreak && "opacity-60",
                )}
              >
                {phase ? formatCountdown(phase.remainingMs) : formatDuration(elapsed)}
              </motion.p>
              <div className={cn("mt-3 space-y-1 text-sm text-white/85 transition-opacity", hidden && "opacity-0")}>
                <p className="font-numeric" suppressHydrationWarning>
                  Focused {formatDuration(elapsed)}
                </p>

                {phase?.isOver ? (
                  <p className="text-white/70">
                    {phase.kind === "work" ? "This interval ran over while you were away; it still counts." : "Break is over."}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <StartHere tracks={tracks} tasksByTrack={tasksByTrack} initialTrackId={initialTrackId} />
          )}
        </div>

        {/* Bottom: the controls, or a way to bring them back. */}
        <div className="flex justify-center p-4 pb-6">
          {hidden ? (
            <Button variant="ghost" size="sm" className={cn("cursor-pointer gap-1.5 rounded-full", GLASS)} onClick={() => setHidden(false)}>
              <Eye className="size-4" aria-hidden />
              Show controls
            </Button>
          ) : session ? (
            <div className={cn("flex items-center gap-1.5 rounded-2xl p-1.5", GLASS, "hover:bg-black/35")}>
              <Button
                variant="ghost"
                className="cursor-pointer gap-2 rounded-xl text-white hover:bg-white/15 hover:text-white"
                disabled={busy}
                onClick={toggle}
              >
                {isPaused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
                {isPaused ? (onBreak ? "Skip break" : "Resume") : "Pause"}
              </Button>
              <Button
                className="cursor-pointer gap-2 rounded-xl bg-white text-black hover:bg-white/90"
                onClick={() => {
                  setFrozenMs(elapsed);
                  setFinishOpen(true);
                }}
              >
                <Square className="size-3.5 fill-current" aria-hidden />
                Finish
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer rounded-xl text-white/70 hover:bg-white/15 hover:text-white"
                    aria-label="Discard session"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Discard this session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {formatCompact(elapsed)} on {session.track.title} will be thrown away and not logged. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">Keep timing</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
                      onClick={() => discard.mutate({ id: session.id })}
                    >
                      Discard
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </div>
      </div>

      {/* The left column: the room you are in, then friends. Phones: above
          the controls, clear of the timer. Wider screens: top left. */}
      {!hidden && ((session?.roomId && roomOpen) || friendsOpen) ? (
        <div className="absolute bottom-24 left-4 z-10 flex max-h-[45%] w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 sm:top-20 sm:bottom-auto sm:max-h-[calc(100%-11rem)]">
          {session?.roomId && roomOpen ? (
            <RoomPanel
              key={session.roomId}
              roomId={session.roomId}
              roomName={rooms.find((r) => r.id === session.roomId)?.name ?? "Your room"}
              onClose={() => setRoomOpen(false)}
            />
          ) : null}
          {friendsOpen ? (
            <FriendsPanel
              friends={friends}
              invitations={invitations}
              running={Boolean(session)}
              onClose={() => setFriendsOpen(false)}
            />
          ) : null}
        </div>
      ) : null}

      {session && notesOpen && !hidden ? (
        <SessionNotes key={session.id} session={session} onClose={() => setNotesOpen(false)} />
      ) : null}

      <BackgroundPicker
        open={panel === "background"}
        onOpenChange={(open) => setPanel(open ? "background" : null)}
        version={pictureVersion}
        onUploaded={() => setPictureVersion((v) => v + 1)}
      />
      <StudyTogether
        open={panel === "together"}
        onOpenChange={(open) => setPanel(open ? "together" : null)}
        rooms={rooms}
        currentRoomId={session?.roomId ?? null}
        running={Boolean(session)}
      />

      {session ? (
        <FinishSessionDialog
          session={session}
          frozenMs={frozenMs}
          open={finishOpen}
          // Not wired to `exit`: after a save the screen offers to start another.
          onOpenChange={setFinishOpen}
        />
      ) : null}
    </div>
  );
}

/** With nothing running: pick a track (and a task, if it has any) and start. */
function StartHere({
  tracks,
  tasksByTrack,
  initialTrackId,
}: {
  tracks: Track[];
  tasksByTrack: Record<string, TrackTask[]>;
  initialTrackId?: string;
}) {
  const start = useStartSession();
  const [trackId, setTrackId] = useState(
    tracks.some((t) => t.id === initialTrackId) ? initialTrackId! : (tracks[0]?.id ?? ""),
  );
  const [taskId, setTaskId] = useState("none");
  const tasks = tasksByTrack[trackId] ?? [];

  if (tracks.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Ready when you are</h1>
        <p className="text-white/80">Create a track first, then come back here to focus on it.</p>
        <Button asChild className="cursor-pointer">
          <Link href="/tracks">Go to Tracks</Link>
        </Button>
      </div>
    );
  }

  function go(mode: "stopwatch" | "pomodoro") {
    start.mutate({ trackId, mode, taskId: taskId === "none" ? undefined : taskId });
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Focus session</h1>
      <p className="text-white/80">Pick what you are working on.</p>
      <div className="space-y-2 text-left [text-shadow:none]">
        <Select
          value={trackId}
          onValueChange={(value) => {
            setTrackId(value);
            setTaskId("none");
          }}
        >
          <SelectTrigger aria-label="Track" className={cn("h-11 w-full cursor-pointer rounded-xl", GLASS)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tracks.map((track) => (
              <SelectItem key={track.id} value={track.id} className="cursor-pointer">
                {track.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tasks.length > 0 ? (
          <Select value={taskId} onValueChange={setTaskId}>
            <SelectTrigger aria-label="Task" className={cn("h-11 w-full cursor-pointer rounded-xl", GLASS)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="cursor-pointer">
                No particular task
              </SelectItem>
              {tasks.map((task) => (
                <SelectItem key={task.id} value={task.id} className="cursor-pointer">
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
      <div className="flex justify-center gap-2 pt-1">
        <Button variant="cta" size="lg" className="cursor-pointer gap-2" disabled={start.isPending || !trackId} onClick={() => go("stopwatch")}>
          <Play className="size-4 fill-current" aria-hidden />
          Start
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className={cn("cursor-pointer gap-2", GLASS)}
          disabled={start.isPending || !trackId}
          onClick={() => go("pomodoro")}
        >
          <Timer className="size-4" aria-hidden />
          Pomodoro
        </Button>
      </div>
    </div>
  );
}
