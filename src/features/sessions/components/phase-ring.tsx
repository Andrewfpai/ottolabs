"use client";

import { cn } from "@/lib/utils";

/**
 * Progress ring for a pomodoro phase.
 *
 * Hand-rolled SVG rather than a library: it is one circle with a dash offset,
 * and it has to sit behind arbitrary children at two very different sizes.
 *
 * The stroke is not animated by Motion. It is redrawn from the phase's own
 * progress four times a second, and a spring on top of that would fight the
 * tick and make the ring lag the digits it surrounds.
 */
export function PhaseRing({
  progress,
  className,
  strokeWidth = 4,
  children,
  tone = "accent",
}: {
  /** 0–1. */
  progress: number;
  className?: string;
  strokeWidth?: number;
  children?: React.ReactNode;
  tone?: "accent" | "muted";
}) {
  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox="0 0 100 100"
        className="size-full -rotate-90"
        aria-hidden
        focusable="false"
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-border"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={tone === "accent" ? "stroke-cta" : "stroke-muted-foreground"}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
