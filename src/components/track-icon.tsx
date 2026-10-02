import {
  Binary,
  BookOpen,
  Brain,
  Calculator,
  Code,
  Cpu,
  Database,
  Dumbbell,
  FlaskConical,
  Globe,
  Languages,
  Music,
  Network,
  Palette,
  Shield,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import type { TrackIcon as TrackIconName } from "@/features/tracks/schema";
import { cn } from "@/lib/utils";

/**
 * Explicit map rather than a dynamic lookup: bundlers cannot tree-shake an
 * icon set addressed by a runtime string, and would ship the entire library.
 */
const ICONS: Record<TrackIconName, LucideIcon> = {
  "book-open": BookOpen,
  database: Database,
  shield: Shield,
  network: Network,
  binary: Binary,
  languages: Languages,
  code: Code,
  terminal: Terminal,
  cpu: Cpu,
  brain: Brain,
  "flask-conical": FlaskConical,
  palette: Palette,
  music: Music,
  dumbbell: Dumbbell,
  calculator: Calculator,
  globe: Globe,
};

export function getTrackIcon(name: string): LucideIcon {
  return ICONS[name as TrackIconName] ?? BookOpen;
}

export function TrackIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  // Property access rather than `getTrackIcon(name)`: calling a function that
  // returns a component during render is indistinguishable, to the compiler,
  // from defining one inline — which would remount the subtree every render.
  const Icon = ICONS[name as TrackIconName] ?? BookOpen;
  return <Icon className={cn("size-4", className)} aria-hidden />;
}
