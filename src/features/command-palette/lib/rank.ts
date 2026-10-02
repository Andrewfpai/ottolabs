/**
 * Matching and ordering for the command palette, kept pure so it is tested
 * rather than eyeballed.
 */
export type CommandGroup = "Timer" | "Start" | "Go to" | "Tasks" | "Preferences";

/** "Tasks" (add a task) last: it is the fallback when nothing else fits. */
export const GROUP_ORDER: CommandGroup[] = ["Timer", "Start", "Go to", "Preferences", "Tasks"];

export type Command = {
  id: string;
  group: CommandGroup;
  label: string;
  /** Extra words that should find this command ("timer", "settings"…). */
  keywords?: string[];
  run: () => void;
};

/** 3 = label starts with the query, 2 = a word in it does, 1 = anywhere, 0 = no match. */
export function matchScore(command: Pick<Command, "label" | "keywords">, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const label = command.label.toLowerCase();
  if (label.startsWith(q)) return 3;
  if (label.split(/[\s·:/–-]+/).some((word) => word.startsWith(q))) return 2;
  if (label.includes(q)) return 1;
  return (command.keywords ?? []).some((k) => k.toLowerCase().startsWith(q)) ? 1 : 0;
}

/**
 * Commands that match, best first; ties keep group order and then their
 * original order, so an empty query shows everything in a stable layout.
 */
export function filterCommands<T extends Pick<Command, "label" | "keywords" | "group">>(
  commands: readonly T[],
  query: string,
): T[] {
  const rank = new Map(GROUP_ORDER.map((g, i) => [g, i]));
  return commands
    .map((command, index) => ({ command, index, score: matchScore(command, query) }))
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (rank.get(a.command.group) ?? 0) - (rank.get(b.command.group) ?? 0) ||
        a.index - b.index,
    )
    .map((r) => r.command);
}

/**
 * Matches grouped for display, plus the same items as one flat list. The flat
 * list is the order the arrow keys walk, so it must be built from the groups
 * as shown — not from the ranking alone, or the highlight jumps around.
 */
export function groupCommands<T extends Pick<Command, "label" | "keywords" | "group">>(
  commands: readonly T[],
  query: string,
): { groups: { group: CommandGroup; items: T[] }[]; ordered: T[] } {
  const matched = filterCommands(commands, query);
  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: matched.filter((c) => c.group === group),
  })).filter((g) => g.items.length > 0);
  return { groups, ordered: groups.flatMap((g) => g.items) };
}
