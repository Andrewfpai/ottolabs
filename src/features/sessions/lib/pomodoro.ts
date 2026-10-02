/**
 * Pomodoro cycle derivation.
 *
 * Like the timer itself, the phase is *derived*, never counted down. There is
 * no "23:41 remaining" stored anywhere — the current phase is a function of
 * the session's stored timestamps plus the configured cycle lengths, so a
 * refresh, a throttled background tab, or a laptop that slept through half a
 * break all resolve to the same answer the moment the page renders again.
 *
 * HOW A CYCLE IS RECONSTRUCTED
 * A break is stored as a pause, so focus time does not accrue during it. That
 * means total focus time after N completed work intervals is N × workMinutes,
 * and the time left in the current interval is simply
 * `(completedCycles + 1) × workMinutes − focusSoFar`. Nothing to persist and
 * nothing to keep in sync.
 *
 * During a break the countdown runs off `breakStartedAt` instead, because
 * break time is wall-clock time and is deliberately not focus time.
 *
 * OVERRUN IS NOT AN ERROR. If the tab was hidden when a work interval elapsed,
 * the interval simply ran long — that time was still spent focusing and is
 * still counted. `remainingMs` goes negative and the UI says so.
 */
import type { PomodoroConfig } from "@/db/schema";
import { elapsedMs, type TimerSnapshot } from "@/lib/time/elapsed";

export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

/** A session as far as the pomodoro engine is concerned. */
export type PomodoroSnapshot = TimerSnapshot & {
  mode: "stopwatch" | "pomodoro";
  completedCycles: number;
  breakMs: number;
  /** Non-null while the open pause is a break rather than a manual pause. */
  breakStartedAt?: Date | string | number | null;
  pomodoroConfig?: PomodoroConfig | null;
};

export type PomodoroPhaseKind = "work" | "break" | "long-break";

export type PomodoroPhase = {
  kind: PomodoroPhaseKind;
  /** Length this phase is meant to run for, in ms. */
  durationMs: number;
  /** Time spent in this phase so far. May exceed `durationMs` on overrun. */
  elapsedMs: number;
  /** Negative once the phase has run past its configured length. */
  remainingMs: number;
  /** 0–1, clamped, for rings and bars. */
  progress: number;
  /** True once the phase is due to end. */
  isOver: boolean;
  /** 1-based index of the work interval this phase belongs to. */
  cycle: number;
  /** Work intervals finished so far in this session. */
  completedCycles: number;
  /** Whether the break after the *current* work interval is a long one. */
  nextBreakIsLong: boolean;
};

function toMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

const MINUTE = 60_000;

/**
 * Clamp a stored config into something usable.
 *
 * Configs are persisted as JSON, so a hand-edited row or an older shape can
 * reach this code. A zero-minute work interval would make the phase maths
 * divide by nothing and the UI flip phases forever, so nonsense is corrected
 * rather than trusted.
 */
export function sanitizeConfig(config?: PomodoroConfig | null): PomodoroConfig {
  const base = config ?? DEFAULT_POMODORO_CONFIG;
  const positive = (value: number, fallback: number) =>
    Number.isFinite(value) && value > 0 ? Math.min(value, 24 * 60) : fallback;

  return {
    workMinutes: positive(base.workMinutes, DEFAULT_POMODORO_CONFIG.workMinutes),
    breakMinutes: positive(base.breakMinutes, DEFAULT_POMODORO_CONFIG.breakMinutes),
    longBreakMinutes: positive(
      base.longBreakMinutes,
      DEFAULT_POMODORO_CONFIG.longBreakMinutes,
    ),
    cyclesBeforeLongBreak: Math.max(
      1,
      Math.round(
        Number.isFinite(base.cyclesBeforeLongBreak)
          ? base.cyclesBeforeLongBreak
          : DEFAULT_POMODORO_CONFIG.cyclesBeforeLongBreak,
      ),
    ),
  };
}

/** True when the session is currently on a pomodoro break. */
export function isOnBreak(session: PomodoroSnapshot): boolean {
  return session.endedAt == null && session.breakStartedAt != null;
}

/**
 * Whether the break following the given number of completed intervals is long.
 *
 * `completedCycles` is the count *after* the interval finishes, so with the
 * default of four the long break falls after intervals 4, 8, 12.
 */
export function breakIsLong(
  completedCycles: number,
  config: PomodoroConfig,
): boolean {
  return completedCycles > 0 && completedCycles % config.cyclesBeforeLongBreak === 0;
}

/**
 * The phase the session is in right now.
 *
 * @param now Epoch ms. Client callers must pass the server-corrected clock.
 */
export function pomodoroPhase(
  session: PomodoroSnapshot,
  now: number = Date.now(),
): PomodoroPhase {
  const config = sanitizeConfig(session.pomodoroConfig);
  const completedCycles = Math.max(0, Math.floor(session.completedCycles));

  if (isOnBreak(session)) {
    const isLong = breakIsLong(completedCycles, config);
    const durationMs =
      (isLong ? config.longBreakMinutes : config.breakMinutes) * MINUTE;
    // A break that ended with the session (finished mid-break) stops there.
    const end = session.endedAt != null ? toMs(session.endedAt) : now;
    const spent = Math.max(0, end - toMs(session.breakStartedAt!));

    return {
      kind: isLong ? "long-break" : "break",
      durationMs,
      elapsedMs: spent,
      remainingMs: durationMs - spent,
      progress: Math.min(1, spent / durationMs),
      isOver: spent >= durationMs,
      // The break belongs to the interval that just finished.
      cycle: completedCycles,
      completedCycles,
      nextBreakIsLong: breakIsLong(completedCycles + 1, config),
    };
  }

  const durationMs = config.workMinutes * MINUTE;
  // Focus time excludes every pause, breaks included, so this is exactly the
  // time that counts toward the current interval.
  const focusMs = elapsedMs(session, now);
  const spent = Math.max(0, focusMs - completedCycles * durationMs);

  return {
    kind: "work",
    durationMs,
    elapsedMs: spent,
    remainingMs: durationMs - spent,
    progress: Math.min(1, spent / durationMs),
    isOver: spent >= durationMs,
    cycle: completedCycles + 1,
    completedCycles,
    nextBreakIsLong: breakIsLong(completedCycles + 1, config),
  };
}

/** `MM:SS`, or `-MM:SS` once a phase has run over. Hours roll into minutes. */
export function formatCountdown(ms: number): string {
  const negative = ms < 0;
  const total = Math.ceil(Math.abs(ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${negative ? "-" : ""}${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function phaseLabel(phase: PomodoroPhase): string {
  if (phase.kind === "long-break") return "Long break";
  if (phase.kind === "break") return "Break";
  return `Focus ${phase.cycle}`;
}
