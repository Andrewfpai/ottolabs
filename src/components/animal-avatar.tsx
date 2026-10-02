import type { ReactNode } from "react";

import { AccessoryArt, type Anchor } from "@/components/avatar-accessories";
import type { AccessoryId, AnimalAvatarId } from "@/lib/avatars";
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

/** Big glossy eyes with two catch-lights: the newer, cuter set uses these. */
const sparkleEyes = (y: number, gap = 11, r = 5) => (
  <>
    {[50 - gap, 50 + gap].map((x) => (
      <g key={x}>
        <circle cx={x} cy={y} r={r} fill={INK} />
        <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.38} fill="#FFFFFF" />
        <circle cx={x + r * 0.35} cy={y + r * 0.3} r={r * 0.18} fill="#FFFFFF" />
      </g>
    ))}
  </>
);

const DRAWINGS: Record<AnimalAvatarId, { bg: string; anchor: Anchor; art: ReactNode }> = {
  cat: {
    bg: "#FAECE7",
    anchor: { eyeY: 56, eyeGap: 10, top: 30, chin: 86 },
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
    anchor: { eyeY: 56, eyeGap: 11, top: 30, chin: 86 },
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
    anchor: { eyeY: 58, eyeGap: 9, top: 33, chin: 87 },
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
    anchor: { eyeY: 54, eyeGap: 10, top: 30, chin: 86 },
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
    anchor: { eyeY: 41, eyeGap: 16, top: 28, chin: 85 },
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
    anchor: { eyeY: 54, eyeGap: 11, top: 30, chin: 86 },
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
    anchor: { eyeY: 54, eyeGap: 10, top: 30, chin: 86 },
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
    anchor: { eyeY: 55, eyeGap: 9, top: 26, chin: 86 },
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
  golden: {
    bg: "#FFF1D6",
    anchor: { eyeY: 51, eyeGap: 11, top: 28, chin: 78 },
    art: (
      <>
        {/* Long feathered ears, a soft muzzle and a tennis ball. */}
        <g fill="#C98B45">
          <ellipse cx="25" cy="55" rx="11" ry="20" transform="rotate(16 25 55)" />
          <circle cx="20" cy="71" r="6.5" />
          <circle cx="28" cy="74" r="5.5" />
          <ellipse cx="75" cy="55" rx="11" ry="20" transform="rotate(-16 75 55)" />
          <circle cx="80" cy="71" r="6.5" />
          <circle cx="72" cy="74" r="5.5" />
        </g>
        <circle cx="50" cy="53" r="25" fill="#E8B064" />
        <path d="M43 30 Q46.5 23 50 29 Q53.5 23 57 30 Z" fill="#E8B064" />
        <ellipse cx="50" cy="64" rx="13.5" ry="10" fill="#F8E2BC" />
        {sparkleEyes(51, 11, 4.8)}
        <ellipse cx="50" cy="60.5" rx="4.6" ry="3.4" fill={INK} />
        <path d="M50 64 Q46.5 68.5 43.5 66 M50 64 Q53.5 68.5 56.5 66" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {blush(63, 19)}
        <circle cx="77" cy="79" r="7.5" fill="#C9E265" />
        <path d="M71.5 74.5 Q76.5 79 71.5 84 M82.5 74.5 Q77.5 79 82.5 84" stroke="#FFFFFF" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  husky: {
    bg: "#E4E6F2",
    anchor: { eyeY: 55, eyeGap: 13, top: 31, chin: 85 },
    art: (
      <>
        {/* The mask, the eyebrow spots and those ice-blue eyes. */}
        <path d="M22 47 L25 14 L45 33 Z M78 47 L75 14 L55 33 Z" fill="#6B7380" />
        <path d="M28 39 L29.5 23 L39 33 Z M72 39 L70.5 23 L61 33 Z" fill="#E2D3D8" />
        <circle cx="50" cy="58" r="27" fill="#7D8794" />
        <path d="M50 38 Q45 49 33 54 Q25 74 50 83 Q75 74 67 54 Q55 49 50 38 Z" fill="#FFFFFF" />
        <ellipse cx="38" cy="45" rx="4.5" ry="2.6" fill="#FFFFFF" />
        <ellipse cx="62" cy="45" rx="4.5" ry="2.6" fill="#FFFFFF" />
        {[37, 63].map((x) => (
          <g key={x}>
            <circle cx={x} cy="55" r="5.2" fill="#5BA4E6" />
            <circle cx={x} cy="55" r="2.8" fill={INK} />
            <circle cx={x - 1.8} cy="53" r="1.9" fill="#FFFFFF" />
            <circle cx={x + 1.8} cy="56.6" r="0.9" fill="#FFFFFF" />
          </g>
        ))}
        <ellipse cx="50" cy="65" rx="4.4" ry="3.2" fill={INK} />
        <path d="M50 68.5 Q46.5 73 43.5 70.5 M50 68.5 Q53.5 73 56.5 70.5" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {blush(69, 20)}
        <path d="M82 18 L82 30 M76.8 21 L87.2 27 M76.8 27 L87.2 21" stroke="#85B7EB" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  corgi: {
    bg: "#E3F0E8",
    anchor: { eyeY: 55, eyeGap: 13, top: 31, chin: 85 },
    art: (
      <>
        {/* Huge ears, a white blaze and a little heart. */}
        <path d="M21 48 L23 11 L45 32 Z M79 48 L77 11 L55 32 Z" fill="#E8913F" strokeLinejoin="round" />
        <path d="M27 40 L28 21 L39 32 Z M73 40 L72 21 L61 32 Z" fill="#FFE3C7" />
        <circle cx="50" cy="58" r="27" fill="#E8913F" />
        <path d="M50 33 Q44 48 39 60 Q36 76 50 80 Q64 76 61 60 Q56 48 50 33 Z" fill="#FFFFFF" />
        <ellipse cx="50" cy="69" rx="15" ry="11" fill="#FFFFFF" />
        {sparkleEyes(55, 13, 4.6)}
        <ellipse cx="50" cy="64" rx="4.4" ry="3.2" fill={INK} />
        <ellipse cx="50" cy="72.5" rx="3.2" ry="4" fill="#F07A93" />
        <path d="M50 67 Q46.5 71.5 43.5 68.5 M50 67 Q53.5 71.5 56.5 68.5" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {blush(68, 21)}
        <path d="M81 28 C73 22 74 13 81 17.5 C88 13 89 22 81 28 Z" fill="#E24B4A" />
      </>
    ),
  },
  koala: {
    bg: "#E8EEF4",
    anchor: { eyeY: 55, eyeGap: 14, top: 32, chin: 86 },
    art: (
      <>
        {/* Fluffy ears, a big button nose and a leaf to wear. */}
        <circle cx="24" cy="42" r="15" fill="#9AA5B1" />
        <circle cx="76" cy="42" r="15" fill="#9AA5B1" />
        <circle cx="24" cy="42" r="8.5" fill="#E2D3D8" />
        <circle cx="76" cy="42" r="8.5" fill="#E2D3D8" />
        <circle cx="50" cy="59" r="27" fill="#B3BCC6" />
        {sparkleEyes(55, 14, 4.4)}
        <ellipse cx="50" cy="64" rx="7.5" ry="9.5" fill="#3D4451" />
        <ellipse cx="47.5" cy="60" rx="2" ry="3" fill="#6B7380" />
        <path d="M45 76 Q50 79 55 76" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {blush(68, 20)}
        <path d="M50 34 Q59 21 72 26 Q62 37 50 34 Z" fill="#86C26A" />
        <path d="M51 33 Q60 28 69 27" stroke="#3B6D11" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  seal: {
    bg: "#D4ECF5",
    anchor: { eyeY: 53, eyeGap: 13, top: 30, chin: 86 },
    art: (
      <>
        {/* A round snow-white pup with huge eyes and whisker dots. */}
        <ellipse cx="50" cy="58" rx="31" ry="28" fill="#FFFFFF" />
        {sparkleEyes(53, 13, 6)}
        <ellipse cx="44.5" cy="66" rx="6.5" ry="5" fill="#EEF3F6" />
        <ellipse cx="55.5" cy="66" rx="6.5" ry="5" fill="#EEF3F6" />
        <g fill="#B4B2A9">
          <circle cx="41" cy="65" r="0.9" />
          <circle cx="44" cy="68" r="0.9" />
          <circle cx="59" cy="65" r="0.9" />
          <circle cx="56" cy="68" r="0.9" />
        </g>
        <ellipse cx="50" cy="62" rx="3.8" ry="2.7" fill={INK} />
        <path d="M47.5 69 Q50 71.5 52.5 69" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {blush(65, 23)}
        <path d="M80 20 L82 26 L88 28 L82 30 L80 36 L78 30 L72 28 L78 26 Z" fill="#85B7EB" />
        <path d="M20 22 L21 25 L24 26 L21 27 L20 30 L19 27 L16 26 L19 25 Z" fill="#85B7EB" />
      </>
    ),
  },
  redpanda: {
    bg: "#F3EAD8",
    anchor: { eyeY: 53, eyeGap: 13, top: 30, chin: 86 },
    art: (
      <>
        {/* White-tipped ears, eyebrow spots and tear marks. */}
        <path d="M21 46 Q17 20 41 29 Z M79 46 Q83 20 59 29 Z" fill="#B9502A" />
        <path d="M26 39 Q24 26 36 30 Z M74 39 Q76 26 64 30 Z" fill="#FFF8F0" />
        <circle cx="50" cy="58" r="28" fill="#D2642F" />
        <path d="M23 61 Q36 58 50 70 Q64 58 77 61 Q73 85 50 86 Q27 85 23 61 Z" fill="#FFF8F0" />
        <ellipse cx="37" cy="43" rx="5.5" ry="3.2" fill="#FFF8F0" />
        <ellipse cx="63" cy="43" rx="5.5" ry="3.2" fill="#FFF8F0" />
        <path d="M36 58 Q33 66 37 72 M64 58 Q67 66 63 72" stroke="#A8461F" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        {sparkleEyes(53, 13, 4.6)}
        <ellipse cx="50" cy="67" rx="4" ry="3" fill={INK} />
        <path d="M50 70 Q47 73.5 44.5 71.5 M50 70 Q53 73.5 55.5 71.5" stroke={INK} strokeWidth="1.7" fill="none" strokeLinecap="round" />
        {blush(73, 17)}
      </>
    ),
  },
  axolotl: {
    bg: PINK_BG,
    anchor: { eyeY: 57, eyeGap: 13, top: 35, chin: 85 },
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
  pinkpup: {
    bg: PINK_BG,
    anchor: { eyeY: 55, eyeGap: 10, top: 22, chin: 82 },
    art: (
      <>
        {/* A fluffy pink pup: cloud ears, a pom on top and a bow. */}
        <g fill="#F48FB1">
          <circle cx="24" cy="50" r="10" />
          <circle cx="20" cy="61" r="9" />
          <circle cx="26" cy="70" r="8" />
          <circle cx="76" cy="50" r="10" />
          <circle cx="80" cy="61" r="9" />
          <circle cx="74" cy="70" r="8" />
        </g>
        <g fill="#F9B4CC">
          <circle cx="50" cy="57" r="25" />
          <circle cx="40" cy="35" r="9" />
          <circle cx="50" cy="31" r="10" />
          <circle cx="60" cy="35" r="9" />
        </g>
        <ellipse cx="50" cy="63" rx="16" ry="13" fill="#FFD9E6" />
        {sparkleEyes(55, 10, 4.6)}
        <ellipse cx="50" cy="63" rx="3.6" ry="2.6" fill={INK} />
        <path d="M50 65.5 Q47 69.5 44.5 67.5 M50 65.5 Q53 69.5 55.5 67.5" stroke={INK} strokeWidth="1.7" fill="none" strokeLinecap="round" />
        {blush(65, 18, "#EC6A98")}
        <path d="M67 27 L58 21 L59 33 Z M67 27 L76 21 L75 33 Z" fill="#EC6A98" />
        <circle cx="67" cy="27" r="3.2" fill="#D4537E" />
      </>
    ),
  },
  hamster: {
    bg: PINK_BG,
    anchor: { eyeY: 55, eyeGap: 10, top: 33, chin: 87 },
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

/**
 * One animal avatar, filling its box, wearing whatever it has earned.
 * Decorative: the name beside it says who it is.
 */
export function AnimalAvatar({
  id,
  accessories = [],
  className,
}: {
  id: AnimalAvatarId;
  /** Already normalised: one per slot, in drawing order. */
  accessories?: readonly AccessoryId[];
  className?: string;
}) {
  const { bg, anchor, art } = DRAWINGS[id];
  return (
    <svg viewBox="0 0 100 100" className={cn("size-full", className)} aria-hidden focusable="false">
      <circle cx="50" cy="50" r="50" fill={bg} />
      {art}
      {accessories.map((accessory) => (
        <AccessoryArt key={accessory} id={accessory} anchor={anchor} />
      ))}
    </svg>
  );
}
