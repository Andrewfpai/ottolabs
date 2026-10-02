import type { ReactNode } from "react";

import type { AnimalAvatarId } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * The built-in animal avatars. Hand-drawn on a 100×100 grid, each on its own
 * pastel circle, so they read the same in light and dark mode. Colours are
 * literal on purpose: they are illustration, not theme.
 */
const INK = "#2C2C2A";
const BLUSH = "#F09595";
const PINK_BG = "#F8D7E3";

const eyes = (y: number, gap = 10) => (
  <>
    <ellipse cx={50 - gap} cy={y} rx="3.5" ry="4.5" fill={INK} />
    <ellipse cx={50 + gap} cy={y} rx="3.5" ry="4.5" fill={INK} />
  </>
);

const blush = (y: number, x = 18, color = BLUSH) => (
  <>
    <circle cx={50 - x} cy={y} r="5" fill={color} opacity=".55" />
    <circle cx={50 + x} cy={y} r="5" fill={color} opacity=".55" />
  </>
);

const DRAWINGS: Record<AnimalAvatarId, { bg: string; art: ReactNode }> = {
  cat: {
    bg: "#FAECE7",
    art: (
      <>
        <path d="M24 46 L28 18 L46 34 Z M76 46 L72 18 L54 34 Z" fill="#F2A65A" />
        <path d="M29 38 L31 26 L40 34 Z M71 38 L69 26 L60 34 Z" fill="#F7C1C1" />
        <circle cx="50" cy="58" r="28" fill="#F2A65A" />
        {eyes(56)}
        {blush(66)}
        <path d="M46 64 Q50 68 50 64 Q50 68 54 64" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  panda: {
    bg: "#E1F5EE",
    art: (
      <>
        <circle cx="27" cy="35" r="10" fill={INK} />
        <circle cx="73" cy="35" r="10" fill={INK} />
        <circle cx="50" cy="58" r="28" fill="#FFFFFF" />
        <ellipse cx="39" cy="56" rx="7" ry="9" fill={INK} transform="rotate(-20 39 56)" />
        <ellipse cx="61" cy="56" rx="7" ry="9" fill={INK} transform="rotate(20 61 56)" />
        <circle cx="40" cy="55" r="2.5" fill="#FFFFFF" />
        <circle cx="60" cy="55" r="2.5" fill="#FFFFFF" />
        <ellipse cx="50" cy="66" rx="3.5" ry="2.5" fill={INK} />
        {blush(68, 19)}
      </>
    ),
  },
  bunny: {
    bg: "#EEEDFE",
    art: (
      <>
        <ellipse cx="39" cy="24" rx="7" ry="18" fill="#FFF8F4" />
        <ellipse cx="61" cy="24" rx="7" ry="18" fill="#FFF8F4" />
        <ellipse cx="39" cy="25" rx="3.5" ry="12" fill="#F4C0D1" />
        <ellipse cx="61" cy="25" rx="3.5" ry="12" fill="#F4C0D1" />
        <circle cx="50" cy="60" r="27" fill="#FFF8F4" />
        {eyes(58, 9)}
        {blush(67, 17, "#ED93B1")}
        <path d="M47 65 L50 68 L53 65 Z" fill="#D4537E" />
      </>
    ),
  },
  bear: {
    bg: "#FAEEDA",
    art: (
      <>
        <circle cx="28" cy="36" r="10" fill="#B07A4F" />
        <circle cx="72" cy="36" r="10" fill="#B07A4F" />
        <circle cx="28" cy="36" r="5" fill="#E8B98A" />
        <circle cx="72" cy="36" r="5" fill="#E8B98A" />
        <circle cx="50" cy="58" r="28" fill="#C68B59" />
        <ellipse cx="50" cy="67" rx="13" ry="10" fill="#EFD3B0" />
        {eyes(54)}
        <ellipse cx="50" cy="63" rx="4" ry="3" fill={INK} />
        <path d="M50 66 L50 70" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  frog: {
    bg: "#EAF3DE",
    art: (
      <>
        <circle cx="34" cy="40" r="12" fill="#86C26A" />
        <circle cx="66" cy="40" r="12" fill="#86C26A" />
        <ellipse cx="50" cy="62" rx="32" ry="23" fill="#86C26A" />
        <circle cx="34" cy="40" r="7.5" fill="#FFFFFF" />
        <circle cx="66" cy="40" r="7.5" fill="#FFFFFF" />
        <circle cx="35" cy="41" r="3.5" fill={INK} />
        <circle cx="65" cy="41" r="3.5" fill={INK} />
        <path d="M38 64 Q50 74 62 64" stroke="#27500A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {blush(62, 22)}
      </>
    ),
  },
  fox: {
    bg: "#FCEBEB",
    art: (
      <>
        <path d="M22 48 L26 16 L46 34 Z M78 48 L74 16 L54 34 Z" fill="#E8783E" />
        <path d="M28 38 L29 25 L39 33 Z M72 38 L71 25 L61 33 Z" fill="#412402" />
        <circle cx="50" cy="58" r="28" fill="#E8783E" />
        <path d="M24 60 Q36 58 50 76 Q64 58 76 60 Q72 84 50 86 Q28 84 24 60 Z" fill="#FFF8F4" />
        {eyes(54, 11)}
        <ellipse cx="50" cy="68" rx="4" ry="3" fill={INK} />
      </>
    ),
  },
  chick: {
    bg: "#FAEEDA",
    art: (
      <>
        <path d="M46 28 Q48 18 54 22 Q50 24 52 30 Z" fill="#EF9F27" />
        <circle cx="50" cy="58" r="28" fill="#FFD45C" />
        {eyes(54)}
        <path d="M44 62 L56 62 L50 69 Z" fill="#EF7A27" />
        {blush(64)}
      </>
    ),
  },
  penguin: {
    bg: "#E6F1FB",
    art: (
      <>
        <circle cx="50" cy="56" r="30" fill="#3D4451" />
        <path d="M50 40 Q30 36 28 58 Q30 80 50 82 Q70 80 72 58 Q70 36 50 40 Z" fill="#FFFFFF" />
        {eyes(55, 9)}
        <path d="M45 62 L55 62 L50 68 Z" fill="#EF9F27" />
        {blush(66, 16)}
      </>
    ),
  },
  axolotl: {
    bg: PINK_BG,
    art: (
      <>
        {/* Feathery gills, three a side. */}
        <g fill="#EC6A98">
          <ellipse cx="20" cy="44" rx="10" ry="4.5" transform="rotate(-30 20 44)" />
          <ellipse cx="15" cy="57" rx="10" ry="4.5" />
          <ellipse cx="20" cy="70" rx="10" ry="4.5" transform="rotate(30 20 70)" />
          <ellipse cx="80" cy="44" rx="10" ry="4.5" transform="rotate(30 80 44)" />
          <ellipse cx="85" cy="57" rx="10" ry="4.5" />
          <ellipse cx="80" cy="70" rx="10" ry="4.5" transform="rotate(-30 80 70)" />
        </g>
        <ellipse cx="50" cy="60" rx="30" ry="25" fill="#FFC4D8" />
        <circle cx="37" cy="57" r="4" fill={INK} />
        <circle cx="63" cy="57" r="4" fill={INK} />
        <circle cx="38.3" cy="55.6" r="1.3" fill="#FFFFFF" />
        <circle cx="64.3" cy="55.6" r="1.3" fill="#FFFFFF" />
        <path d="M43 66 Q50 72 57 66" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        {blush(67, 22, "#EC6A98")}
      </>
    ),
  },
  piglet: {
    bg: PINK_BG,
    art: (
      <>
        <path d="M24 44 L26 22 L42 34 Z M76 44 L74 22 L58 34 Z" fill="#F59BBB" />
        <circle cx="50" cy="58" r="28" fill="#FFC4D8" />
        {eyes(52, 11)}
        <ellipse cx="50" cy="66" rx="11" ry="8" fill="#F59BBB" />
        <ellipse cx="46" cy="66" rx="2" ry="3" fill="#993556" />
        <ellipse cx="54" cy="66" rx="2" ry="3" fill="#993556" />
        {blush(64, 21, "#EC6A98")}
      </>
    ),
  },
  hamster: {
    bg: PINK_BG,
    art: (
      <>
        <circle cx="30" cy="37" r="8" fill="#F2B880" />
        <circle cx="70" cy="37" r="8" fill="#F2B880" />
        <circle cx="30" cy="37" r="4.5" fill="#F7C1C1" />
        <circle cx="70" cy="37" r="4.5" fill="#F7C1C1" />
        <ellipse cx="50" cy="60" rx="31" ry="27" fill="#F2B880" />
        <ellipse cx="50" cy="71" rx="22" ry="14" fill="#FFF8F0" />
        {eyes(55, 10)}
        <path d="M47.5 63 L52.5 63 L50 66 Z" fill="#D4537E" />
        <path d="M46 68 Q48 70 50 68 Q52 70 54 68" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {blush(67, 21)}
      </>
    ),
  },
};

/** One animal avatar, filling its box. Decorative: the name beside it says who it is. */
export function AnimalAvatar({ id, className }: { id: AnimalAvatarId; className?: string }) {
  const { bg, art } = DRAWINGS[id];
  return (
    <svg viewBox="0 0 100 100" className={cn("size-full", className)} aria-hidden focusable="false">
      <circle cx="50" cy="50" r="50" fill={bg} />
      {art}
    </svg>
  );
}
