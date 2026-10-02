"use client";

import { useEffect, useSyncExternalStore } from "react";

import { setSessionSound } from "@/features/sounds/lib/engine";
import {
  DEFAULT_SOUND_PREFS,
  readSoundPrefs,
  shouldPlay,
  type SoundPrefs,
  subscribeSoundPrefs,
} from "@/features/sounds/lib/prefs";

export function useSoundPrefs(): SoundPrefs {
  return useSyncExternalStore(subscribeSoundPrefs, readSoundPrefs, () => DEFAULT_SOUND_PREFS);
}

/**
 * Plays the chosen soundscape while focus time accrues and fades it out on a
 * pause or a break. Mounted once, in `TimerBar` (AGENTS rule 13).
 */
export function useFocusSounds(session: { endedAt: Date | null; pausedAt: Date | null } | null | undefined) {
  const prefs = useSoundPrefs();
  const sound = shouldPlay(session, prefs) && prefs.sound !== "off" ? prefs.sound : null;

  useEffect(() => {
    setSessionSound({ sound, volume: prefs.volume });
  }, [sound, prefs.volume]);

  // Leaving the app shell (signing out) must not leave a soundscape playing.
  useEffect(() => () => setSessionSound({ sound: null, volume: 0 }), []);
}
