/**
 * Focus sound preferences: which soundscape and how loud. Per device
 * (localStorage), like the Pomodoro alerts — headphones on the laptop, silence
 * on the phone is a reasonable thing to want.
 */
export const SOUNDSCAPES = [
  { id: "rain", label: "Rain", description: "Steady rain with drops close by" },
  { id: "cafe", label: "Café", description: "Distant chatter and the odd cup" },
  { id: "brown", label: "Brown noise", description: "Deep, even rumble" },
  { id: "ocean", label: "Ocean waves", description: "Slow waves rolling in" },
  { id: "fire", label: "Fireplace", description: "A low fire that crackles" },
] as const;

export type SoundscapeId = (typeof SOUNDSCAPES)[number]["id"];

export type SoundPrefs = { sound: SoundscapeId | "off"; volume: number };

/** Off until chosen: a timer that starts making noise unasked is a surprise. */
export const DEFAULT_SOUND_PREFS: SoundPrefs = { sound: "off", volume: 0.5 };

const KEY = "ottolabs:focus-sounds";

export function isSoundscape(value: unknown): value is SoundscapeId {
  return SOUNDSCAPES.some((s) => s.id === value);
}

export function parseSoundPrefs(raw: string | null): SoundPrefs {
  if (!raw) return DEFAULT_SOUND_PREFS;
  try {
    const value = JSON.parse(raw) as Partial<SoundPrefs>;
    const volume = typeof value.volume === "number" && Number.isFinite(value.volume) ? value.volume : DEFAULT_SOUND_PREFS.volume;
    return {
      sound: value.sound === "off" || isSoundscape(value.sound) ? value.sound : DEFAULT_SOUND_PREFS.sound,
      volume: Math.min(1, Math.max(0, volume)),
    };
  } catch {
    return DEFAULT_SOUND_PREFS;
  }
}

/**
 * Whether the soundscape should be audible. Only while focus time is
 * accruing: a pause or a Pomodoro break is the moment to hear the room again.
 */
export function shouldPlay(
  session: { endedAt: Date | null; pausedAt: Date | null } | null | undefined,
  prefs: SoundPrefs,
): boolean {
  return Boolean(session && !session.endedAt && !session.pausedAt && prefs.sound !== "off");
}

// ── An external store for useSyncExternalStore ─────────────────────────────

let cached: SoundPrefs | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readSoundPrefs(): SoundPrefs {
  cached ??= parseSoundPrefs(storage()?.getItem(KEY) ?? null);
  return cached;
}

export function writeSoundPrefs(prefs: SoundPrefs): void {
  cached = prefs;
  try {
    storage()?.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Kept for this page's lifetime even if it cannot be saved.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSoundPrefs(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cached = null;
    listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
