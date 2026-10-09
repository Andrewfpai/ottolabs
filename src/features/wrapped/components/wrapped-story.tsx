"use client";

import { motion, useReducedMotion } from "motion/react";
import { Download, Pause, Play, Share2, X } from "lucide-react";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { AnimalAvatar } from "@/components/animal-avatar";
import { PersonAvatar } from "@/features/friends/components/person-avatar";
import {
  changeVsLastMonth,
  hourLabel,
  bestDayLine,
  friendsLine,
  introLine,
  reviewsLine,
  streakLine,
  topTrackLine,
  totalLine,
  peakHour,
  persona,
  type WrappedData,
} from "@/features/wrapped/lib/wrapped";
import { ACCESSORIES, wear } from "@/lib/avatars";
import { formatCompact } from "@/lib/time/elapsed";
import { TRACK_COLOR_CLASSES, trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

/** How long each slide shows before moving on by itself. */
const SLIDE_MS = 6_500;

type Slide = {
  key: string;
  /** Full-bleed background: gradient plus the colours of the floating shapes. */
  bg: string;
  shapes: [string, string, string];
  ink?: "light" | "dark";
  body: ReactNode;
  /** The last slide waits for you instead of moving on. */
  hold?: boolean;
};

// ── Pieces ─────────────────────────────────────────────────────────────────

/** A line that rises into place, one after another within a slide. */
function Rise({ i = 0, children, className }: { i?: number; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + i * 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** The big flat shapes drifting behind every slide. */
function Shapes({ colors }: { colors: [string, string, string] }) {
  const reduce = useReducedMotion();
  const spin = (seconds: number, dir = 1) =>
    reduce ? {} : { animate: { rotate: 360 * dir }, transition: { duration: seconds, repeat: Infinity, ease: "linear" as const } };
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -top-24 -right-20 size-72 rounded-[38%]"
        style={{ background: colors[0] }}
        {...spin(40)}
      />
      <motion.div
        className="absolute -bottom-28 -left-16 size-80 rounded-full"
        style={{ background: colors[1] }}
        {...spin(60, -1)}
      />
      <motion.div
        className="absolute top-1/2 -right-10 size-28 rounded-[30%]"
        style={{ background: colors[2] }}
        {...spin(25)}
      />
    </div>
  );
}

/** Your avatar, animal and accessories included, or your photo. */
function Me({ data, size = "size-24", extra }: { data: WrappedData; size?: string; extra?: WrappedData["milestones"][number]["reward"] }) {
  const { person } = data;
  if (person.animal) {
    return (
      <span className={cn("block overflow-hidden rounded-full ring-4 ring-white/80", size)}>
        <AnimalAvatar id={person.animal} accessories={extra ? wear(person.accessories, extra) : person.accessories} />
      </span>
    );
  }
  return <PersonAvatar name={person.name} image={person.image} className={cn("ring-4 ring-white/80", size)} />;
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold tracking-[0.18em] uppercase opacity-80">{children}</p>;
}

function Big({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[3.4rem] leading-[0.95] font-black tracking-tight sm:text-6xl", className)}>{children}</p>;
}

// ── The slides ─────────────────────────────────────────────────────────────

function slidesFor(data: WrappedData): Slide[] {
  const top = data.tracks[0];
  const peak = peakHour(data.hours);
  const me = persona(data);
  const change = changeVsLastMonth(data.focusMs, data.previousFocusMs);
  const maxTrack = Math.max(1, ...data.tracks.map((t) => t.ms));
  const maxHour = Math.max(1, ...data.hours);
  const accent = (color: string) => TRACK_COLOR_CLASSES[color as keyof typeof TRACK_COLOR_CLASSES]?.cssVar ?? "var(--track-teal)";

  const slides: Slide[] = [
    {
      key: "intro",
      bg: "linear-gradient(160deg, #2A0E61 0%, #6A1B9A 55%, #E040A0 100%)",
      shapes: ["#FF6FB5", "#3D1A8C", "#FFD166"],
      body: (
        <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
          <Rise>
            <Me data={data} size="size-32" />
          </Rise>
          <Rise i={1}>
            <Kicker>OttoLabs Wrapped</Kicker>
          </Rise>
          <Rise i={2}>
            <Big>
              Your {data.monthName},
              <br />
              wrapped.
            </Big>
          </Rise>
          <Rise i={3}>
            <p className="max-w-[16rem] text-lg opacity-90">{introLine(data.month)}</p>
          </Rise>
        </div>
      ),
    },
    {
      key: "total",
      bg: "linear-gradient(170deg, #0B3D2E 0%, #0F5E44 60%, #1DB954 100%)",
      shapes: ["#B8F35B", "#0A2E22", "#1ED760"],
      body: (
        <div className="flex h-full flex-col justify-center gap-5">
          <Rise>
            <Kicker>This month you focused for</Kicker>
          </Rise>
          <Rise i={1}>
            <Big className="text-[#C9FF6B] sm:text-7xl">{formatCompact(data.focusMs)}</Big>
          </Rise>
          {change ? (
            <Rise i={2}>
              <span className="inline-block rounded-full bg-black/25 px-3 py-1 text-sm font-semibold">{change}</span>
            </Rise>
          ) : null}
          <Rise i={3}>
            <p className="text-xl leading-snug font-semibold">{totalLine(data.month, data.focusMs)}</p>
          </Rise>
          <Rise i={4}>
            <p className="opacity-85">
              On {data.activeDays} of {data.daysInMonth} days.
            </p>
          </Rise>
        </div>
      ),
    },
  ];

  if (top) {
    slides.push({
      key: "top-track",
      bg: `linear-gradient(165deg, color-mix(in oklch, ${accent(top.color)} 55%, black) 0%, ${accent(top.color)} 100%)`,
      shapes: ["rgba(255,255,255,0.18)", "rgba(0,0,0,0.18)", "rgba(255,255,255,0.3)"],
      body: (
        <div className="flex h-full flex-col justify-center gap-5">
          <Rise>
            <Kicker>Your number one</Kicker>
          </Rise>
          <Rise i={1}>
            <Big className="break-words">{top.title}</Big>
          </Rise>
          <Rise i={2}>
            <p className="text-2xl font-bold">{formatCompact(top.ms)} of focus</p>
          </Rise>
          <Rise i={3}>
            <p className="text-lg opacity-90">
              {topTrackLine(data.month, Math.round((top.ms / Math.max(1, data.focusMs)) * 100))}
            </p>
          </Rise>
        </div>
      ),
    });
  }

  if (data.tracks.length > 1) {
    slides.push({
      key: "top-five",
      bg: "linear-gradient(180deg, #121212 0%, #1F1F2E 100%)",
      shapes: ["#2A2A40", "#1A1A26", "#33334D"],
      body: (
        <div className="flex h-full flex-col justify-center gap-6">
          <Rise>
            <Kicker>Your top tracks</Kicker>
          </Rise>
          <ol className="space-y-4">
            {data.tracks.slice(0, 5).map((track, i) => (
              <Rise key={track.title} i={i + 1}>
                <li className="flex items-center gap-4">
                  <span className="w-8 text-3xl font-black opacity-60">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xl font-bold">{track.title}</span>
                      <span className="shrink-0 text-sm opacity-80">{formatCompact(track.ms)}</span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className={cn("h-full rounded-full", trackColorClasses(track.color).bg)}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((track.ms / maxTrack) * 100)}%` }}
                        transition={{ delay: 0.4 + i * 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                </li>
              </Rise>
            ))}
          </ol>
        </div>
      ),
    });
  }

  if (peak !== null) {
    slides.push({
      key: "rhythm",
      bg: "linear-gradient(175deg, #0A1033 0%, #1B2A6B 70%, #3B4FCF 100%)",
      // Blues only: the chart's peak bar is the one yellow thing on this slide.
      shapes: ["#5B6CFF", "#121A4A", "#2C3FA8"],
      body: (
        <div className="flex h-full flex-col justify-center gap-5">
          <Rise>
            <Kicker>Your rhythm</Kicker>
          </Rise>
          <Rise i={1}>
            <Big>
              {me.emoji} {peak >= 21 || peak < 4 ? "Night owl" : peak < 10 ? "Early bird" : peak < 17 ? "Daytime grinder" : "Evening focus"}
            </Big>
          </Rise>
          <Rise i={2}>
            <p className="text-xl font-semibold">You focused most around {hourLabel(peak)}.</p>
          </Rise>
          <Rise i={3}>
            <div className="mt-2 flex h-28 items-end gap-[3px]">
              {data.hours.map((ms, hour) => (
                <motion.div
                  key={hour}
                  className={cn("flex-1 rounded-t-sm", hour === peak ? "bg-[#FFD166]" : "bg-white/35")}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, (ms / maxHour) * 100)}%` }}
                  transition={{ delay: 0.6 + hour * 0.02, duration: 0.5 }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] opacity-70">
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>11 PM</span>
            </div>
          </Rise>
        </div>
      ),
    });
  }

  slides.push({
    key: "best-day",
    bg: "linear-gradient(160deg, #FF5F1F 0%, #FF2E63 100%)",
    shapes: ["#FFB347", "#C2185B", "#FFE066"],
    body: (
      <div className="flex h-full flex-col justify-center gap-5">
        {data.bestDay ? (
          <>
            <Rise>
              <Kicker>Your biggest day</Kicker>
            </Rise>
            <Rise i={1}>
              <Big>{data.bestDay.label}</Big>
            </Rise>
            <Rise i={2}>
              <p className="text-2xl font-bold">{bestDayLine(data.month, formatCompact(data.bestDay.ms))}</p>
            </Rise>
          </>
        ) : null}
        <Rise i={3}>
          <div className="mt-4 rounded-3xl bg-black/20 p-5">
            <p className="text-sm font-semibold tracking-wider uppercase opacity-80">Longest streak</p>
            <p className="mt-1 text-5xl font-black">
              {data.longestStreak} {data.longestStreak === 1 ? "day" : "days"} 🔥
            </p>
            <p className="mt-1 opacity-90">{streakLine(data.month)}</p>
          </div>
        </Rise>
      </div>
    ),
  });

  slides.push({
    key: "sessions",
    bg: "linear-gradient(170deg, #003B46 0%, #07575B 55%, #12B5A5 100%)",
    shapes: ["#66FCF1", "#022C33", "#F7B32B"],
    body: (
      <div className="flex h-full flex-col justify-center gap-4">
        <Rise>
          <Kicker>By the numbers</Kicker>
        </Rise>
        {[
          { n: data.sessions, label: "sessions" },
          { n: data.pomodoros, label: "Pomodoros finished" },
          { n: formatCompact(data.longestSessionMs), label: "your longest sitting" },
        ].map((row, i) => (
          <Rise key={row.label} i={i + 1}>
            <p className="text-6xl font-black">{row.n}</p>
            <p className="text-lg font-semibold opacity-85">{row.label}</p>
          </Rise>
        ))}
      </div>
    ),
  });

  if (data.tasksDone + data.reviewsDone > 0) {
    slides.push({
      key: "tasks",
      bg: "linear-gradient(165deg, #FFD60A 0%, #FFB703 100%)",
      shapes: ["#FB8500", "#FFE57A", "#FFFFFF"],
      ink: "dark",
      body: (
        <div className="flex h-full flex-col justify-center gap-5 text-[#1B1300]">
          <Rise>
            <Kicker>Things you got done</Kicker>
          </Rise>
          <Rise i={1}>
            <Big>{data.tasksDone} tasks ✅</Big>
          </Rise>
          {data.reviewsDone > 0 ? (
            <Rise i={2}>
              <p className="text-2xl font-bold">{reviewsLine(data.month, data.reviewsDone)}</p>
            </Rise>
          ) : null}
        </div>
      ),
    });
  }

  if (data.roomMs > 0 || data.topBuddy) {
    slides.push({
      key: "friends",
      bg: "linear-gradient(160deg, #3A0CA3 0%, #7209B7 50%, #F72585 100%)",
      shapes: ["#4CC9F0", "#560BAD", "#FFBE0B"],
      body: (
        <div className="flex h-full flex-col justify-center gap-5">
          <Rise>
            <Kicker>Better together</Kicker>
          </Rise>
          <Rise i={1}>
            <Big>{formatCompact(data.roomMs)}</Big>
          </Rise>
          <Rise i={2}>
            <p className="text-xl font-semibold">{friendsLine(data.month)}</p>
          </Rise>
          {data.topBuddy ? (
            <Rise i={3}>
              <div className="mt-2 flex items-center gap-3 rounded-3xl bg-black/20 p-4">
                <PersonAvatar name={data.topBuddy.name} image={data.topBuddy.image} className="size-14 ring-2 ring-white/70" />
                <div>
                  <p className="text-sm opacity-80">Your study buddy of the month</p>
                  <p className="text-2xl font-black">{data.topBuddy.name}</p>
                </div>
              </div>
            </Rise>
          ) : null}
        </div>
      ),
    });
  }

  if (data.milestones.length > 0) {
    const reward = data.milestones[0].reward;
    slides.push({
      key: "milestones",
      bg: "linear-gradient(170deg, #1A1446 0%, #3F2B96 60%, #A8C0FF 100%)",
      shapes: ["#FFD166", "#271C66", "#C3B1E1"],
      body: (
        <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
          <Rise>
            <Kicker>Unlocked this month</Kicker>
          </Rise>
          <Rise i={1}>
            <Me data={data} size="size-36" extra={reward} />
          </Rise>
          <Rise i={2}>
            <p className="text-3xl font-black">{data.milestones.map((m) => m.title).join(" · ")}</p>
          </Rise>
          <Rise i={3}>
            <p className="text-lg opacity-90">
              New look: {data.milestones.map((m) => ACCESSORIES.find((a) => a.id === m.reward)?.label.toLowerCase()).join(", ")}.
            </p>
          </Rise>
        </div>
      ),
    });
  }

  slides.push({
    key: "persona",
    bg: "linear-gradient(155deg, #FF006E 0%, #8338EC 50%, #3A86FF 100%)",
    shapes: ["#FFBE0B", "#FB5607", "#06D6A0"],
    body: (
      <div className="flex h-full flex-col justify-center gap-5">
        <Rise>
          <Kicker>Your study persona</Kicker>
        </Rise>
        <Rise i={1}>
          <p className="text-7xl">{me.emoji}</p>
        </Rise>
        <Rise i={2}>
          <Big>{me.title}</Big>
        </Rise>
        <Rise i={3}>
          <p className="text-xl font-semibold opacity-95">{me.line}</p>
        </Rise>
      </div>
    ),
  });

  slides.push({
    key: "share",
    bg: "linear-gradient(180deg, #0E0E12 0%, #1C1C26 100%)",
    shapes: ["#22223A", "#15151F", "#2A2A44"],
    hold: true,
    body: <ShareSlide data={data} />,
  });

  return slides;
}

/** The summary card, sized like a story, ready to share. */
export function SummaryCard({ data, cardRef }: { data: WrappedData; cardRef?: React.Ref<HTMLDivElement> }) {
  const me = persona(data);
  const peak = peakHour(data.hours);
  return (
    <div
      ref={cardRef}
      className="relative flex aspect-[9/16] w-full flex-col overflow-hidden rounded-3xl p-5 text-white"
      style={{ background: "linear-gradient(160deg, #6A1B9A 0%, #E040A0 55%, #FF8A00 100%)" }}
    >
      <div aria-hidden className="absolute -top-16 -right-16 size-48 rounded-[38%] bg-[#FFD166]/90" />
      <div aria-hidden className="absolute -bottom-20 -left-12 size-56 rounded-full bg-[#3D1A8C]/80" />
      <div className="relative flex items-center gap-3">
        <Me data={data} size="size-14" />
        <div className="min-w-0">
          <p className="truncate text-lg leading-tight font-black">{data.person.name}</p>
          <p className="text-xs font-semibold tracking-wider uppercase opacity-85">
            {data.monthName} {data.year} · Wrapped
          </p>
        </div>
      </div>
      <div className="relative mt-auto space-y-3">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase opacity-80">Focused</p>
          <p className="text-5xl leading-none font-black">{formatCompact(data.focusMs)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider uppercase opacity-80">Top tracks</p>
            <ol className="mt-1 space-y-0.5 text-sm font-bold">
              {data.tracks.slice(0, 3).map((t, i) => (
                <li key={t.title} className="truncate">
                  {i + 1}. {t.title}
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase opacity-80">Streak</p>
              <p className="text-lg font-black">{data.longestStreak} days 🔥</p>
            </div>
            {peak !== null ? (
              <div>
                <p className="text-xs font-semibold tracking-wider uppercase opacity-80">Peak hour</p>
                <p className="text-lg font-black">{hourLabel(peak)}</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl bg-black/25 px-3 py-2">
          <p className="text-xs font-semibold tracking-wider uppercase opacity-80">Persona</p>
          <p className="text-lg font-black">
            {me.emoji} {me.title}
          </p>
        </div>
        <p className="pt-1 text-right text-xs font-bold tracking-widest uppercase opacity-80">OttoLabs</p>
      </div>
    </div>
  );
}

function ShareSlide({ data }: { data: WrappedData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Rise className="w-[78%] max-w-[300px]">
        <SummaryCard data={data} />
      </Rise>
      <Rise i={1} className="flex gap-2">
        <button
          type="button"
          data-no-advance
          className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-white/90"
        >
          <Share2 className="size-4" aria-hidden />
          Share
        </button>
        <button
          type="button"
          data-no-advance
          className="flex cursor-pointer items-center gap-2 rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold hover:bg-white/10"
        >
          <Download className="size-4" aria-hidden />
          Save image
        </button>
      </Rise>
    </div>
  );
}

// ── The player ─────────────────────────────────────────────────────────────

/** The bars along the top: done, filling, waiting. Owns the clock. */
function Progress({
  count,
  index,
  paused,
  hold,
  onDone,
}: {
  count: number;
  index: number;
  paused: boolean;
  hold: boolean;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let elapsed = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (!paused) elapsed += now - last;
      last = now;
      const p = Math.min(1, elapsed / SLIDE_MS);
      setProgress(p);
      if (p >= 1) {
        if (!hold) done.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [index, paused, hold]);

  return (
    <div className="flex gap-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
          <div
            className="h-full bg-white"
            style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Wrapped, story style: tap right for next, left for back, hold to pause.
 * Arrow keys and Space work too; Esc closes.
 */
export function WrappedStory({ data, onClose }: { data: WrappedData; onClose: () => void }) {
  const slides = slidesFor(data);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pressedAt = useRef(0);
  const slide = slides[index];

  const next = useCallback(() => setIndex((i) => Math.min(slides.length - 1, i + 1)), [slides.length]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") back();
      else if (event.key === " ") {
        event.preventDefault();
        setPaused((p) => !p);
      } else if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onClose]);

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const held = performance.now() - pressedAt.current > 250;
    setPaused(false);
    if (held) return;
    if ((event.target as HTMLElement).closest("[data-no-advance]")) return;
    const { left, width } = event.currentTarget.getBoundingClientRect();
    if (event.clientX - left < width * 0.3) back();
    else next();
  }

  const style: CSSProperties = { background: slide.bg };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div
        className={cn(
          "relative h-dvh w-full overflow-hidden select-none sm:h-[min(92dvh,860px)] sm:w-auto sm:aspect-[9/16] sm:rounded-3xl",
          slide.ink === "dark" ? "text-[#1B1300]" : "text-white",
        )}
        style={style}
        onPointerDown={() => {
          pressedAt.current = performance.now();
          setPaused(true);
        }}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setPaused(false)}
        role="region"
        aria-roledescription="story"
        aria-label={`Wrapped, slide ${index + 1} of ${slides.length}`}
      >
        <Shapes key={`${slide.key}-shapes`} colors={slide.shapes} />

        <div className="relative z-10 flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex-1">
            <Progress count={slides.length} index={index} paused={paused} hold={Boolean(slide.hold)} onDone={next} />
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between px-4 pt-2">
          <span className="text-xs font-bold tracking-widest uppercase opacity-80">
            {data.monthName} {data.year}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-no-advance
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play" : "Pause"}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-white/15"
            >
              {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
            </button>
            <button
              type="button"
              data-no-advance
              onPointerUp={(e) => e.stopPropagation()}
              onClick={onClose}
              aria-label="Close Wrapped"
              className="flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-white/15"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <div key={slide.key} className="relative z-10 h-[calc(100%-4.5rem)] px-7 pb-10">
          {slide.body}
        </div>
      </div>
    </div>
  );
}
