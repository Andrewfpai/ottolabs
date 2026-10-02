import { describe, expect, it } from "vitest";

import { zonedInstant } from "@/lib/time/calendar-day";

import {
  deadlineMessage,
  deviceLabel,
  eveningKey,
  goalGapMessage,
  roomAlertKey,
  roomStartMessage,
  tasksDueTomorrow,
} from "../reminders";

const TZ = "Asia/Shanghai";
// 20:00 on Saturday 3 October in Shanghai — when the evening check runs.
const NOW = zonedInstant("2026-10-03", "20:00", TZ).getTime();

describe("tasksDueTomorrow", () => {
  const task = (title: string, day: string, time: string | null, status: "todo" | "done" = "todo") => ({
    title,
    dueAt: zonedInstant(day, time, TZ),
    status,
  });

  it("picks open tasks due on tomorrow's local date, all-day or timed", () => {
    const due = tasksDueTomorrow(
      [
        task("all-day tomorrow", "2026-10-04", null),
        task("late tomorrow", "2026-10-04", "23:59"),
        task("today", "2026-10-03", "22:00"),
        task("the day after", "2026-10-05", "00:00"),
        task("done already", "2026-10-04", "10:00", "done"),
        { title: "no deadline", dueAt: null, status: "todo" as const },
      ],
      NOW,
      TZ,
    );
    expect(due.map((t) => t.title)).toEqual(["all-day tomorrow", "late tomorrow"]);
  });

  it("uses the user's zone, not UTC", () => {
    // 01:00 on the 4th in Shanghai is still the 3rd in UTC.
    expect(tasksDueTomorrow([task("x", "2026-10-04", "01:00")], NOW, TZ)).toHaveLength(1);
  });
});

describe("deadlineMessage", () => {
  it("names a single task", () => {
    expect(deadlineMessage([{ title: "Finish chapter 4" }])).toMatchObject({
      title: "Due tomorrow",
      body: "Finish chapter 4",
      url: "/tasks",
    });
  });

  it("summarises several", () => {
    expect(deadlineMessage([{ title: "A" }, { title: "B" }])?.body).toBe("A and B");
    expect(deadlineMessage([{ title: "A" }, { title: "B" }, { title: "C" }, { title: "D" }])).toMatchObject({
      title: "4 tasks due tomorrow",
      body: "A, B and 2 more",
    });
  });

  it("sends nothing when nothing is due", () => {
    expect(deadlineMessage([])).toBeNull();
  });
});

describe("goalGapMessage", () => {
  const min = (n: number) => n * 60_000;

  it("says how far off you are", () => {
    expect(goalGapMessage(min(90), 120)).toMatchObject({
      title: "30m to today's goal",
      body: "You have focused 1h 30m of 2h today.",
    });
  });

  it("is gentle when nothing is logged yet", () => {
    expect(goalGapMessage(0, 120)?.body).toBe("Nothing logged yet today. Your goal is 2h.");
  });

  it("stays quiet once the goal is met, or within a minute of it", () => {
    expect(goalGapMessage(min(120), 120)).toBeNull();
    expect(goalGapMessage(min(150), 120)).toBeNull();
    expect(goalGapMessage(min(119) + 30_000, 120)).toBeNull();
  });
});

describe("roomStartMessage", () => {
  it("links to the room", () => {
    expect(roomStartMessage({ name: "Sam", roomName: "Finals grind", roomId: "r1" })).toEqual({
      title: "Sam started focusing",
      body: "In Finals grind. Join them?",
      url: "/rooms/r1",
      tag: "room-r1",
    });
  });
});

describe("dedupe keys", () => {
  it("allows one evening reminder of each kind per local day", () => {
    expect(eveningKey("deadlines", "2026-10-03")).toBe("deadlines:2026-10-03");
    expect(eveningKey("goal", "2026-10-03")).not.toBe(eveningKey("deadlines", "2026-10-03"));
  });

  it("allows one room alert per person per room per 30 minutes", () => {
    const at = (m: number) => roomAlertKey("r1", "sam", m * 60_000);
    expect(at(0)).toBe(at(29));
    expect(at(0)).not.toBe(at(30));
    expect(roomAlertKey("r1", "sam", 0)).not.toBe(roomAlertKey("r1", "ana", 0));
  });
});

describe("deviceLabel", () => {
  it("tells common devices apart", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iPhone");
    expect(
      deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"),
    ).toBe("Chrome on Windows");
    expect(
      deviceLabel("Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36"),
    ).toBe("Chrome on Android");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0",
      ),
    ).toBe("Edge on Windows");
  });
});
