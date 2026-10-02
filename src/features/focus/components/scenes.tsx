/**
 * Focus-screen scenes: pixel-art landscapes drawn in code on a 320×180 grid
 * and scaled up with crisp edges, so they cost no downloads and belong to
 * no one else. Every random choice comes from a seeded generator, so the
 * server and the browser draw the same picture.
 *
 * Animation is CSS (`ol-*` keyframes in globals.css), stilled by the
 * reduced-motion rule there.
 */
import type { CSSProperties, ReactNode } from "react";

import type { SceneId } from "@/features/focus/lib/background";

const W = 320;
const H = 180;

/** mulberry32: small, fast, and the same everywhere for the same seed. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const between = (r: Rand, min: number, max: number) => min + Math.floor(r() * (max - min + 1));

const anim = (name: string, seconds: number, delay = 0, extra = ""): CSSProperties => ({
  animation: `${name} ${seconds}s ${extra || "ease-in-out"} ${delay}s infinite`,
});

/** Horizontal sky bands with a dithered seam between each pair. */
function sky(colors: string[], height: number, key: string): ReactNode[] {
  const band = height / colors.length;
  const out: ReactNode[] = [];
  colors.forEach((color, i) => {
    out.push(<rect key={`${key}b${i}`} x={0} y={Math.floor(i * band)} width={W} height={Math.ceil(band) + 1} fill={color} />);
    if (i > 0) {
      // A checker row of the band above, the way pixel art fakes a gradient.
      const y = Math.floor(i * band);
      for (let x = 0; x < W; x += 4) {
        out.push(<rect key={`${key}d${i}-${x}`} x={x + (i % 2) * 2} y={y} width={2} height={1} fill={colors[i - 1]} />);
      }
    }
  });
  return out;
}

/** A filled pixel disk, row by row. */
function disk(cx: number, cy: number, r: number, color: string, key: string, clipBelow = H): ReactNode[] {
  const out: ReactNode[] = [];
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y >= clipBelow) break;
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    out.push(<rect key={`${key}${dy}`} x={cx - half} y={y} width={half * 2} height={1} fill={color} />);
  }
  return out;
}

function stars(r: Rand, count: number, maxY: number, color: string, key: string): ReactNode[] {
  return Array.from({ length: count }, (_, i) => {
    const big = r() < 0.15;
    return (
      <rect
        key={`${key}${i}`}
        x={between(r, 0, W - 1)}
        y={between(r, 0, maxY)}
        width={big ? 2 : 1}
        height={big ? 2 : 1}
        fill={color}
        style={r() < 0.6 ? anim("ol-twinkle", 2 + r() * 4, r() * 4) : undefined}
      />
    );
  });
}

type SkylineOptions = {
  baseY: number;
  minH: number;
  maxH: number;
  minW: number;
  maxW: number;
  color: string;
  window?: { color: string; chance: number; flicker?: number };
  antennas?: boolean;
};

/** A row of buildings across the whole width, optionally with lit windows. */
function skyline(r: Rand, o: SkylineOptions, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let x = -between(r, 0, 8);
  let i = 0;
  while (x < W) {
    const w = between(r, o.minW, o.maxW);
    const h = between(r, o.minH, o.maxH);
    const top = o.baseY - h;
    out.push(<rect key={`${key}${i}`} x={x} y={top} width={w} height={h + 1} fill={o.color} />);
    if (o.antennas && r() < 0.25) {
      out.push(<rect key={`${key}a${i}`} x={x + Math.floor(w / 2)} y={top - between(r, 3, 8)} width={1} height={8} fill={o.color} />);
    }
    if (o.window) {
      for (let wy = top + 3; wy < o.baseY - 2; wy += 4) {
        for (let wx = x + 2; wx < x + w - 2; wx += 3) {
          if (r() >= o.window.chance) continue;
          const flicker = o.window.flicker && r() < o.window.flicker;
          out.push(
            <rect
              key={`${key}w${i}-${wx}-${wy}`}
              x={wx}
              y={wy}
              width={2}
              height={2}
              fill={o.window.color}
              style={flicker ? anim("ol-flicker", 3 + r() * 6, r() * 5) : undefined}
            />,
          );
        }
      }
    }
    x += w + between(r, 0, 2);
    i++;
  }
  return out;
}

/** Jagged pixel ridges for mountains: a column per 2 pixels, walking up and down. */
function ridge(r: Rand, baseY: number, minY: number, maxY: number, color: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let y = between(r, minY, maxY);
  for (let x = 0; x < W; x += 2) {
    y = Math.max(minY, Math.min(maxY, y + between(r, -2, 2)));
    out.push(<rect key={`${key}${x}`} x={x} y={y} width={2} height={baseY - y} fill={color} />);
  }
  return out;
}

/** Falling streaks or petals, drawn twice (one screen apart) so the loop is seamless. */
function falling(
  r: Rand,
  count: number,
  draw: (x: number, y: number, i: number) => ReactNode,
  seconds: number,
  key: string,
): ReactNode {
  const items = Array.from({ length: count }, (_, i) => ({ x: between(r, 0, W + 40), y: between(r, 0, H) , i }));
  return (
    <g key={key} style={anim("ol-fall", seconds, 0, "linear")}>
      {items.map(({ x, y, i }) => draw(x, y, i))}
      {items.map(({ x, y, i }) => draw(x, y + H, i + count))}
    </g>
  );
}

// ── The scenes ─────────────────────────────────────────────────────────────

function sundown(): ReactNode {
  const r = rng(7);
  return (
    <>
      {sky(["#3B2A55", "#55356A", "#7A4677", "#A3587F", "#C96B7D", "#E3867B", "#F2A77F", "#F7C98E"], 132, "s")}
      {stars(r, 45, 60, "#FFE6F0", "st")}
      {disk(160, 104, 24, "#F9D7A8", "sun")}
      {disk(160, 104, 19, "#FCE6BE", "sun2")}
      {skyline(r, { baseY: 150, minH: 30, maxH: 70, minW: 10, maxW: 22, color: "#B4708A", antennas: true }, "far")}
      {skyline(r, { baseY: 160, minH: 25, maxH: 60, minW: 12, maxW: 26, color: "#83506F", window: { color: "#E9B27E", chance: 0.12 } }, "mid")}
      {skyline(r, { baseY: 181, minH: 22, maxH: 58, minW: 14, maxW: 30, color: "#2A2240", window: { color: "#F4CF78", chance: 0.22, flicker: 0.25 }, antennas: true }, "near")}
      <rect x={0} y={172} width={W} height={8} fill="#1C1730" />
    </>
  );
}

function rain(): ReactNode {
  const r = rng(21);
  return (
    <>
      {sky(["#0B1424", "#0F1B30", "#14233D", "#1A2C4A", "#21365A"], 140, "s")}
      {disk(250, 36, 12, "#9FB3D1", "moon")}
      {disk(254, 33, 10, "#14233D", "moonbite")}
      {skyline(r, { baseY: 150, minH: 35, maxH: 85, minW: 10, maxW: 22, color: "#1E2D47", window: { color: "#3E5F8A", chance: 0.15 }, antennas: true }, "far")}
      {skyline(r, { baseY: 166, minH: 30, maxH: 70, minW: 14, maxW: 28, color: "#121C30", window: { color: "#F2C46B", chance: 0.18, flicker: 0.3 } }, "near")}
      <rect x={0} y={166} width={W} height={14} fill="#0C1322" />
      {/* Puddle reflections shimmering. */}
      {Array.from({ length: 22 }, (_, i) => (
        <rect
          key={`p${i}`}
          x={between(r, 0, W - 10)}
          y={between(r, 168, 178)}
          width={between(r, 4, 12)}
          height={1}
          fill={r() < 0.5 ? "#F2C46B" : "#5D7FB0"}
          style={anim("ol-shimmer", 1.5 + r() * 2, r() * 2)}
        />
      ))}
      {falling(r, 70, (x, y, i) => <rect key={`r${i}`} x={x - 20} y={y} width={1} height={6} fill="#8FA9CF" opacity={0.55} />, 0.9, "rain1")}
      {falling(r, 40, (x, y, i) => <rect key={`q${i}`} x={x - 20} y={y} width={1} height={9} fill="#B7C9E6" opacity={0.45} />, 0.6, "rain2")}
    </>
  );
}

function sakura(): ReactNode {
  const r = rng(33);
  const blossom = ["#F4A6C0", "#F8C3D4", "#E98AAE", "#FBD5E1"];
  const canopy: ReactNode[] = [];
  for (let i = 0; i < 70; i++) {
    const cx = 205 + between(r, -50, 50);
    const cy = 74 + between(r, -32, 20);
    canopy.push(...disk(cx, cy, between(r, 7, 13), blossom[i % blossom.length], `c${i}-`));
  }
  return (
    <>
      {sky(["#F1C9D8", "#F6D6E1", "#FAE2E8", "#FCECEC", "#FEF4EE"], 120, "s")}
      {disk(84, 44, 14, "#FFF6EC", "sun")}
      {ridge(r, 140, 72, 98, "#D9C6E5", "m1")}
      {ridge(r, 150, 92, 112, "#C2A8D4", "m2")}
      <rect x={0} y={128} width={W} height={52} fill="#A9CF9F" />
      {ridge(r, 181, 122, 132, "#93C08B", "hill")}
      <rect x={0} y={160} width={W} height={20} fill="#7DB078" />
      {/* Trunk and branches. */}
      <rect x={200} y={92} width={10} height={60} fill="#7A4E3A" />
      <rect x={178} y={96} width={24} height={4} fill="#7A4E3A" />
      <rect x={208} y={88} width={26} height={4} fill="#7A4E3A" />
      {canopy}
      {/* Fallen petals on the grass. */}
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={`g${i}`} x={between(r, 150, 270)} y={between(r, 150, 176)} width={2} height={1} fill={blossom[i % 4]} />
      ))}
      {Array.from({ length: 28 }, (_, i) => (
        <rect
          key={`pt${i}`}
          x={between(r, 140, 330)}
          y={between(r, 40, 120)}
          width={2}
          height={2}
          fill={blossom[i % 4]}
          style={anim("ol-petal", 7 + r() * 6, -r() * 12, "linear")}
        />
      ))}
    </>
  );
}

function ocean(): ReactNode {
  const r = rng(45);
  return (
    <>
      {sky(["#2C3F72", "#46598E", "#6F74A6", "#A889A9", "#D69E9E", "#EFB892", "#F7CF98"], 112, "s")}
      {stars(r, 18, 34, "#E9ECFF", "st")}
      {disk(160, 110, 20, "#FFD9A0", "sun", 112)}
      {disk(160, 110, 15, "#FFE8BF", "sun2", 112)}
      {/* Clouds drifting. */}
      <g style={anim("ol-drift", 120, 0, "linear")}>
        {[0, W].map((offset) => (
          <g key={offset}>
            <rect x={30 + offset} y={40} width={40} height={4} fill="#E9B4AE" />
            <rect x={38 + offset} y={36} width={22} height={4} fill="#E9B4AE" />
            <rect x={210 + offset} y={58} width={54} height={4} fill="#DDA0A6" />
            <rect x={222 + offset} y={54} width={26} height={4} fill="#DDA0A6" />
          </g>
        ))}
      </g>
      <rect x={0} y={112} width={W} height={68} fill="#2E5583" />
      <rect x={0} y={128} width={W} height={52} fill="#264B78" />
      <rect x={0} y={150} width={W} height={30} fill="#1F416C" />
      {/* The sun's path on the water. */}
      {Array.from({ length: 16 }, (_, i) => (
        <rect
          key={`path${i}`}
          x={160 - between(r, 4, 18)}
          y={114 + i * 4}
          width={between(r, 8, 36)}
          height={1}
          fill="#FFD9A0"
          style={anim("ol-shimmer", 1.2 + r() * 1.6, r() * 2)}
        />
      ))}
      {Array.from({ length: 40 }, (_, i) => (
        <rect
          key={`w${i}`}
          x={between(r, 0, W - 12)}
          y={between(r, 116, 176)}
          width={between(r, 4, 14)}
          height={1}
          fill="#8FB6DE"
          style={anim("ol-shimmer", 2 + r() * 3, r() * 3)}
        />
      ))}
      {/* A small sailboat. */}
      <rect x={58} y={126} width={22} height={4} fill="#1A2238" />
      <rect x={61} y={130} width={16} height={2} fill="#1A2238" />
      <rect x={68} y={104} width={2} height={22} fill="#1A2238" />
      <path d="M70 105 L70 124 L82 124 Z" fill="#F4E6D4" />
    </>
  );
}

function camp(): ReactNode {
  const r = rng(58);
  const pines: ReactNode[] = [];
  for (let i = 0; i < 18; i++) {
    const x = between(r, 0, W);
    const h = between(r, 16, 34);
    const base = 158 + between(r, -2, 4);
    for (let row = 0; row < h; row += 2) {
      const half = Math.floor((row / h) * (h / 3)) + 1;
      pines.push(<rect key={`pine${i}-${row}`} x={x - half} y={base - h + row} width={half * 2} height={2} fill="#0E1328" />);
    }
  }
  return (
    <>
      {sky(["#070B1E", "#0B1230", "#111A42", "#18235A", "#202C6A"], 150, "s")}
      {/* The Milky Way: a dense diagonal band of faint stars. */}
      {Array.from({ length: 120 }, (_, i) => {
        const t = r();
        return (
          <rect
            key={`mw${i}`}
            x={Math.floor(t * W)}
            y={Math.floor(20 + t * 60 + (r() - 0.5) * 28)}
            width={1}
            height={1}
            fill="#9AA6E0"
            opacity={0.5}
          />
        );
      })}
      {stars(r, 70, 120, "#F3F5FF", "st")}
      <g style={anim("ol-shoot", 11, 2, "linear")}>
        <rect x={250} y={24} width={12} height={1} fill="#FFFFFF" transform="rotate(-27 256 24)" />
      </g>
      {ridge(r, 160, 96, 124, "#1A2047", "m1")}
      {ridge(r, 170, 118, 140, "#141938", "m2")}
      {pines}
      <rect x={0} y={158} width={W} height={22} fill="#0B0F22" />
      {/* Tent. */}
      <path d="M118 158 L134 132 L150 158 Z" fill="#D9744A" />
      <path d="M130 158 L134 146 L138 158 Z" fill="#3B1F14" />
      {/* Campfire, glowing and flickering. */}
      {/* The glow's faintness is on the group: the flicker animates the circle's own opacity. */}
      <g opacity={0.2}>
        <circle cx={176} cy={154} r={16} fill="#F59E4A" style={anim("ol-flicker", 1.4)} />
      </g>
      <rect x={170} y={157} width={12} height={2} fill="#5B3A22" />
      <g style={anim("ol-flicker", 0.9)}>
        <rect x={173} y={150} width={6} height={7} fill="#F2853A" />
        <rect x={174} y={146} width={4} height={5} fill="#F9C74F" />
        <rect x={175} y={143} width={2} height={3} fill="#FFE8A3" />
      </g>
    </>
  );
}

const SCENES: Record<SceneId, () => ReactNode> = { sundown, rain, sakura, ocean, camp };
// Drawn once per scene; the shapes never change.
const cache = new Map<SceneId, ReactNode>();

/** A scene filling its box, cropped to cover like a background image. */
export function FocusScene({ id, className }: { id: SceneId; className?: string }) {
  if (!cache.has(id)) cache.set(id, SCENES[id]());
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      className={`ol-scene ${className ?? ""}`}
      aria-hidden
      focusable="false"
    >
      {cache.get(id)}
    </svg>
  );
}
