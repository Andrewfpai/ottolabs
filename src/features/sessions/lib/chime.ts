/**
 * A short tone at a pomodoro transition.
 *
 * Synthesised rather than shipped as an audio file: it is two sine tones, and
 * an asset would be a network request and a cache entry for something that is
 * eight lines of arithmetic.
 *
 * Deliberately not the Notification API — that needs a permission prompt, and
 * a tracker that opens with a browser permission dialog is a tracker you stop
 * using. The transition also only ever fires while the tab is in front, so
 * there is nobody to notify who is not already looking at it.
 *
 * Fails silently. Autoplay policy blocks audio until the page has been
 * interacted with; a session resumed after a refresh may therefore be silent,
 * which is not worth an error.
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

/** Rising for "back to work", falling for "take a break". */
const TONES: Record<"work" | "break", [number, number]> = {
  work: [523.25, 783.99],
  break: [783.99, 523.25],
};

export function playChime(kind: "work" | "break"): void {
  const ctx = getContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") void ctx.resume();

    TONES[kind].forEach((frequency, index) => {
      const start = ctx.currentTime + index * 0.18;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      // Ramped rather than switched: an abrupt start or stop on a sine wave
      // clicks audibly.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });
  } catch {
    // Blocked by autoplay policy, or no audio device. Not worth surfacing.
  }
}
