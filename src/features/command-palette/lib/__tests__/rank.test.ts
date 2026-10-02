import { describe, expect, it } from "vitest";

import { type CommandGroup, filterCommands, groupCommands, matchScore } from "../rank";

const cmd = (label: string, group: CommandGroup = "Go to", keywords?: string[]) => ({ label, group, keywords });

describe("matchScore", () => {
  it("prefers the start of the label, then the start of a word, then anywhere", () => {
    expect(matchScore(cmd("Settings"), "set")).toBe(3);
    expect(matchScore(cmd("Start Pomodoro: Databases"), "data")).toBe(2);
    expect(matchScore(cmd("Analytics"), "lyt")).toBe(1);
    expect(matchScore(cmd("Analytics"), "zzz")).toBe(0);
  });

  it("is case-insensitive and ignores surrounding space", () => {
    expect(matchScore(cmd("Dashboard"), "  DASH ")).toBe(3);
  });

  it("finds a command by its keywords", () => {
    expect(matchScore(cmd("Start: Databases", "Start", ["timer"]), "tim")).toBe(1);
  });

  it("matches everything for an empty query", () => {
    expect(matchScore(cmd("Tasks"), "")).toBe(1);
  });
});

describe("filterCommands", () => {
  const commands = [
    cmd("Dashboard"),
    cmd("Start: Databases", "Start"),
    cmd("Tasks"),
    cmd("Switch to light theme", "Preferences"),
  ];

  it("keeps group order for an empty query", () => {
    expect(filterCommands(commands, "").map((c) => c.label)).toEqual([
      "Start: Databases",
      "Dashboard",
      "Tasks",
      "Switch to light theme",
    ]);
  });

  it("puts the strongest match first and drops non-matches", () => {
    expect(filterCommands(commands, "da").map((c) => c.label)).toEqual(["Dashboard", "Start: Databases"]);
  });
});

describe("groupCommands", () => {
  it("walks the keyboard in the order shown, with Add task last", () => {
    const commands = [cmd("Add task “ana”", "Tasks"), cmd("Analytics"), cmd("Dashboard")];
    const { groups, ordered } = groupCommands(commands, "ana");
    expect(groups.map((g) => g.group)).toEqual(["Go to", "Tasks"]);
    expect(ordered.map((c) => c.label)).toEqual(["Analytics", "Add task “ana”"]);
  });
});
