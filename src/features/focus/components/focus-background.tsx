"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { FocusScene } from "@/features/focus/components/scenes";
import {
  type Background,
  DEFAULT_BACKGROUND,
  loadCustomPicture,
  readBackground,
  subscribeBackground,
} from "@/features/focus/lib/background";

export function useBackground(): Background {
  return useSyncExternalStore(subscribeBackground, readBackground, () => DEFAULT_BACKGROUND);
}

/** An object URL for the uploaded picture, while it is the chosen background. */
export function useCustomPictureUrl(active: boolean, version = 0): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let live = true;
    let made: string | null = null;
    void loadCustomPicture().then((blob) => {
      if (!live || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [active, version]);

  return active ? url : null;
}

/**
 * The full-screen backdrop: the chosen scene, or your picture. Darkened top
 * and bottom so white text stays readable on anything.
 */
export function FocusBackground({ version }: { version: number }) {
  const background = useBackground();
  const picture = useCustomPictureUrl(background === "custom", version);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#141022]">
      {background === "custom" ? (
        picture ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob URL; next/image cannot optimise it
          <img src={picture} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null
      ) : (
        <FocusScene id={background} className="absolute inset-0 size-full" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/55" />
    </div>
  );
}
