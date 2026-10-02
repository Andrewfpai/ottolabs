import type { ReactNode } from "react";

import type { AccessoryId } from "@/lib/avatars";

/**
 * Where an accessory sits on a given animal, on the same 100×100 grid:
 * the eye line and spacing for glasses, the top of the head for hats, and
 * the chin for anything worn at the neck.
 */
export type Anchor = { eyeY: number; eyeGap: number; top: number; chin: number };

const INK = "#2C2C2A";
const GOLD = "#F5C542";
const GOLD_DARK = "#C9921A";

/** A four-pointed sparkle centred on (x, y). */
const star = (x: number, y: number, r: number, fill: string) => (
  <path
    d={`M${x} ${y - r} Q${x + r * 0.22} ${y - r * 0.22} ${x + r} ${y} Q${x + r * 0.22} ${y + r * 0.22} ${x} ${y + r} Q${x - r * 0.22} ${y + r * 0.22} ${x - r} ${y} Q${x - r * 0.22} ${y - r * 0.22} ${x} ${y - r} Z`}
    fill={fill}
  />
);

const FLOWER_COLORS = ["#F4C0D1", "#FFFFFF", "#CECBF6", "#FAC775", "#F4C0D1"];

const ART: Record<AccessoryId, (a: Anchor) => ReactNode> = {
  headphones: ({ eyeY, top }) => (
    <>
      <path
        d={`M20 ${eyeY - 6} Q20 ${top - 12} 50 ${top - 12} Q80 ${top - 12} 80 ${eyeY - 6}`}
        stroke="#3D4451"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="12" y={eyeY - 12} width="13" height="20" rx="6" fill="#E24B4A" />
      <rect x="75" y={eyeY - 12} width="13" height="20" rx="6" fill="#E24B4A" />
      <rect x="15" y={eyeY - 8} width="5" height="12" rx="2.5" fill="#F7C1C1" />
      <rect x="80" y={eyeY - 8} width="5" height="12" rx="2.5" fill="#F7C1C1" />
    </>
  ),
  gradcap: ({ top }) => (
    <>
      <path d={`M35 ${top - 4} L35 ${top + 4} Q50 ${top + 11} 65 ${top + 4} L65 ${top - 4} Z`} fill="#3D4451" />
      <path d={`M50 ${top - 17} L80 ${top - 7} L50 ${top + 2} L20 ${top - 7} Z`} fill={INK} />
      <path d={`M50 ${top - 7} L74 ${top - 5} L74 ${top + 9}`} stroke="#EF9F27" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="74" cy={top + 10} r="2.4" fill="#EF9F27" />
      <circle cx="50" cy={top - 7} r="1.8" fill="#EF9F27" />
    </>
  ),
  crown: ({ top }) => (
    <>
      <path
        d={`M31 ${top + 3} L29 ${top - 15} L40 ${top - 6} L50 ${top - 20} L60 ${top - 6} L71 ${top - 15} L69 ${top + 3} Z`}
        fill={GOLD}
        stroke={GOLD_DARK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="29" cy={top - 15} r="2" fill={GOLD} />
      <circle cx="50" cy={top - 20} r="2.2" fill={GOLD} />
      <circle cx="71" cy={top - 15} r="2" fill={GOLD} />
      <circle cx="50" cy={top - 4} r="2.6" fill="#E24B4A" />
      <circle cx="39" cy={top - 1} r="1.9" fill="#378ADD" />
      <circle cx="61" cy={top - 1} r="1.9" fill="#378ADD" />
    </>
  ),
  halo: ({ top }) => (
    <>
      <ellipse cx="50" cy={top - 11} rx="19" ry="5.5" fill="none" stroke="#FFF1C2" strokeWidth="7" opacity="0.7" />
      <ellipse cx="50" cy={top - 11} rx="19" ry="5.5" fill="none" stroke={GOLD} strokeWidth="3.2" />
    </>
  ),
  beanie: ({ top }) => (
    <>
      <path d={`M27 ${top + 6} Q27 ${top - 19} 50 ${top - 19} Q73 ${top - 19} 73 ${top + 6} Z`} fill="#E24B4A" />
      <rect x="25" y={top + 1} width="50" height="8" rx="4" fill="#C93A3A" />
      <path
        d={`M50 ${top - 16} L42 ${top - 21} L47 ${top - 15} L40 ${top - 13} L48 ${top - 13} L50 ${top - 7} L52 ${top - 13} L60 ${top - 13} L53 ${top - 15} L58 ${top - 21} Z`}
        fill="#639922"
      />
      <path d={`M50 ${top - 18} Q51 ${top - 24} 54 ${top - 25}`} stroke="#3B6D11" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="38" cy={top - 9} rx="3" ry="2" fill="#F09595" opacity="0.7" />
    </>
  ),
  flowers: ({ top }) => (
    <>
      {[26, 37.5, 50, 62.5, 74].map((x, i) => {
        const y = top + 6 - 9 * Math.sin((Math.PI * (x - 22)) / 56);
        const color = FLOWER_COLORS[i];
        return (
          <g key={x}>
            {i < 4 ? <ellipse cx={x + 6} cy={y + 1} rx="3.5" ry="1.8" fill="#86C26A" transform={`rotate(-20 ${x + 6} ${y + 1})`} /> : null}
            {[0, 72, 144, 216, 288].map((deg) => (
              <circle
                key={deg}
                cx={x + 3.2 * Math.cos((deg * Math.PI) / 180)}
                cy={y + 3.2 * Math.sin((deg * Math.PI) / 180)}
                r="2.7"
                fill={color}
                stroke="#E2D3D8"
                strokeWidth="0.4"
              />
            ))}
            <circle cx={x} cy={y} r="1.9" fill="#EF9F27" />
          </g>
        );
      })}
    </>
  ),
  nightcap: ({ top }) => (
    <>
      <path d={`M29 ${top + 5} Q40 ${top - 26} 80 ${top - 13} Q66 ${top - 7} 71 ${top + 5} Z`} fill="#534AB7" />
      <rect x="27" y={top} width="46" height="8" rx="4" fill="#FFFFFF" />
      <circle cx="81" cy={top - 12} r="5.5" fill="#FFFFFF" />
      {star(45, top - 9, 2.6, "#FAC775")}
      {star(59, top - 12, 2, "#FAC775")}
      {star(52, top - 3, 1.6, "#FAC775")}
    </>
  ),
  glasses: ({ eyeY, eyeGap }) => {
    const r = Math.min(8.5, eyeGap * 0.72);
    return (
      <>
        <circle cx={50 - eyeGap} cy={eyeY} r={r} fill="#FFFFFF" fillOpacity="0.18" stroke="#3D4451" strokeWidth="2.2" />
        <circle cx={50 + eyeGap} cy={eyeY} r={r} fill="#FFFFFF" fillOpacity="0.18" stroke="#3D4451" strokeWidth="2.2" />
        <path d={`M${50 - eyeGap + r} ${eyeY} Q50 ${eyeY - 3} ${50 + eyeGap - r} ${eyeY}`} stroke="#3D4451" strokeWidth="2.2" fill="none" />
      </>
    );
  },
  sunglasses: ({ eyeY, eyeGap }) => {
    const r = Math.min(9, eyeGap * 0.78);
    return (
      <>
        <path
          d={`M${50 - eyeGap - r} ${eyeY - r * 0.55} L${50 + eyeGap + r} ${eyeY - r * 0.55}`}
          stroke={INK}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <ellipse cx={50 - eyeGap} cy={eyeY + 0.5} rx={r} ry={r * 0.78} fill={INK} />
        <ellipse cx={50 + eyeGap} cy={eyeY + 0.5} rx={r} ry={r * 0.78} fill={INK} />
        <path d={`M${50 - eyeGap - r * 0.5} ${eyeY - r * 0.2} l${r * 0.45} ${-r * 0.3}`} stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        <path d={`M${50 + eyeGap - r * 0.5} ${eyeY - r * 0.2} l${r * 0.45} ${-r * 0.3}`} stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      </>
    );
  },
  scarf: ({ chin }) => (
    <>
      <path d={`M23 ${chin - 7} Q50 ${chin + 3} 77 ${chin - 7} L79 ${chin} Q50 ${chin + 10} 21 ${chin} Z`} fill="#E24B4A" />
      <path d={`M30 ${chin - 3} L32 ${chin + 4} M42 ${chin} L43 ${chin + 6} M58 ${chin} L57 ${chin + 6} M70 ${chin - 3} L68 ${chin + 4}`} stroke="#FFFFFF" strokeWidth="1.6" opacity="0.8" />
      <path d={`M58 ${chin + 3} L66 ${chin + 13} L59 ${chin + 15} L53 ${chin + 5} Z`} fill="#C93A3A" />
    </>
  ),
  medal: ({ chin }) => (
    <>
      <path d={`M40 ${chin - 9} L50 ${chin + 2} L60 ${chin - 9}`} stroke="#378ADD" strokeWidth="4.5" fill="none" strokeLinejoin="round" />
      <circle cx="50" cy={chin + 6} r="6.5" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.2" />
      {star(50, chin + 6, 3.4, "#FFFFFF")}
    </>
  ),
  bowtie: ({ chin }) => (
    <>
      <path d={`M50 ${chin - 1} L38 ${chin - 8} L38 ${chin + 6} Z M50 ${chin - 1} L62 ${chin - 8} L62 ${chin + 6} Z`} fill="#E24B4A" strokeLinejoin="round" />
      <circle cx="41.5" cy={chin - 3} r="1.2" fill="#FFFFFF" opacity="0.8" />
      <circle cx="58.5" cy={chin + 1} r="1.2" fill="#FFFFFF" opacity="0.8" />
      <rect x="46.5" y={chin - 4.5} width="7" height="7" rx="2.5" fill="#C93A3A" />
    </>
  ),
  mug: () => (
    // Drawn small at the corner, then scaled up and pulled inside the circle.
    <g transform="translate(25 67) scale(1.25) translate(-20 -75)">
      <path d="M17 66 Q15 61 18 58 M22 66 Q20 61 23 58" stroke="#B4B2A9" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M27 74 Q34 74 33 79 Q32 83 27 83" stroke="#FFFFFF" strokeWidth="3" fill="none" />
      <rect x="12" y="70" width="17" height="18" rx="4" fill="#FFFFFF" stroke="#D3D1C7" strokeWidth="1" />
      <ellipse cx="20.5" cy="71.5" rx="7" ry="2" fill="#8A5A3B" />
      <path d="M17 79 Q20.5 76 24 79 Q20.5 84 17 79 Z" fill="#F09595" />
    </g>
  ),
  sparkles: () => (
    <>
      {star(16, 24, 6.5, GOLD)}
      {star(84, 30, 4.5, "#FAC775")}
      {star(86, 70, 3.5, GOLD)}
      {star(13, 62, 3, "#FAC775")}
    </>
  ),
  bird: () => (
    <g transform="translate(24 70) scale(1.3) translate(-17 -74)">
      <path d="M13 80 L11 85 M17 80 L16 85" stroke="#EF9F27" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="17" cy="73" rx="9" ry="8" fill="#85B7EB" />
      <ellipse cx="18.5" cy="76" rx="5.5" ry="4.5" fill="#E6F1FB" />
      <path d="M10 72 Q14 66 19 71 Q14 74 10 72 Z" fill="#378ADD" />
      <circle cx="21" cy="69.5" r="1.4" fill={INK} />
      <path d="M25 70 L29 71.5 L25 73 Z" fill="#EF9F27" />
      <circle cx="19" cy="72.5" r="1.4" fill="#F09595" opacity="0.6" />
    </g>
  ),
};

/** One accessory, drawn for one animal. */
export function AccessoryArt({ id, anchor }: { id: AccessoryId; anchor: Anchor }) {
  return <g>{ART[id](anchor)}</g>;
}
