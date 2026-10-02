/**
 * The bell at the end of a Pomodoro phase.
 *
 * Synthesised rather than shipped as an audio file: a few sine partials with
 * a bell-like decay are a handful of lines, where an asset would be a network
 * request and a cache entry.
 *
 * Browsers keep audio blocked until the page has been interacted with, and a
 * phase usually ends while you are somewhere else. So the audio context is
 * created and resumed on your first click or key press (`unlockAudio`), and
 * from then on a background tab can ring. If it was never unlocked — a session
 * resumed after a refresh with no click since — it fails silently.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    context ??= new AudioContext();
    return context;
  } catch {
    return null;
  }
}

/**
 * Call once on mount: the first pointer or key event unlocks audio for the
 * rest of the page's life.
 */
export function unlockAudioOnFirstGesture(): () => void {
  if (typeof window === "undefined") return () => {};
  const unlock = () => {
    const ctx = getContext();
    if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
    remove();
  };
  const remove = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  return remove;
}

/**
 * Falling for "take a break", rising for "back to work" — the direction says
 * which without looking.
 */
const MELODIES: Record<"work" | "break", number[]> = {
  work: [523.25, 659.25, 783.99, 1046.5],
  break: [1046.5, 783.99, 659.25],
};

function bell(ctx: AudioContext, frequency: number, start: number, volume: number) {
  // A fundamental plus a quieter octave partial reads as a bell, not a beep.
  for (const [multiple, level] of [
    [1, 1],
    [2, 0.3],
  ] as const) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency * multiple;
    // Ramped, never switched: an abrupt start or stop on a sine clicks.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume * level, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.95);
  }
}

export function playChime(kind: "work" | "break"): void {
  const ctx = getContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    MELODIES[kind].forEach((frequency, index) => {
      bell(ctx, frequency, ctx.currentTime + 0.05 + index * 0.22, 0.22);
    });
  } catch {
    // Blocked by autoplay policy, or no audio device. Not worth surfacing.
  }
}
