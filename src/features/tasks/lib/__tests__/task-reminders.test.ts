import { describe, expect, it } from "vitest";

import { describeOffset, normalizeOffsets, reminderFireAt, taskReminderMessage } from "../task-reminders";

const TZ = "Asia/Jakarta";

describe("normalizeOffsets", () => {
  it("dedupes, drops nonsense, keeps at most eight, furthest first", () => {
    expect(normalizeOffsets([60, 1440, 60, -5, 1.5, 0, 99999999])).toEqual([1440, 60, 0]);
    expect(normalizeOffsets([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toHaveLength(8);
  });
});

describe("describeOffset", () => {
  it("reads naturally", () => {
    expect(describeOffset(0)).toBe("At the deadline");
    expect(describeOffset(30)).toBe("30 minutes before");
    expect(describeOffset(120)).toBe("2 hours before");
    expect(describeOffset(1440)).toBe("1 day before");
    expect(describeOffset(10080)).toBe("1 week before");
    expect(describeOffset(90)).toBe("1 h 30 min before");
  });
});

describe("reminderFireAt", () => {
  const due = new Date("2026-10-09T07:00:00Z"); // 14:00 in Jakarta

  it("counts back from a timed deadline", () => {
    expect(reminderFireAt({ dueAt: due, isAllDay: false }, 120, TZ)?.toISOString()).toBe("2026-10-09T05:00:00.000Z");
  });

  it("counts back from 09:00 on an all-day deadline's day", () => {
    // All-day Friday 9 Oct: 09:00 Jakarta is 02:00 UTC; a day before is Thursday 09:00.
    const allDay = new Date("2026-10-08T17:00:00Z");
    expect(reminderFireAt({ dueAt: allDay, isAllDay: true }, 1440, TZ)?.toISOString()).toBe("2026-10-08T02:00:00.000Z");
  });

  it("has nothing to ring without a deadline", () => {
    expect(reminderFireAt({ dueAt: null, isAllDay: false }, 60, TZ)).toBeNull();
  });
});

describe("taskReminderMessage", () => {
  const due = new Date("2026-10-09T07:00:00Z");

  it("says how soon, in the person's zone", () => {
    const soon = taskReminderMessage({ taskId: "t", title: "Homework 1", dueAt: due, isAllDay: false, now: due.getTime() - 30 * 60_000, timeZone: TZ });
    expect(soon.title).toBe("⏰ Homework 1");
    expect(soon.body).toBe("Due in 30 min, at 14:00.");
    const later = taskReminderMessage({ taskId: "t", title: "Homework 1", dueAt: due, isAllDay: false, now: due.getTime() - 5 * 3_600_000, timeZone: TZ });
    expect(later.body).toBe("Due today at 14:00.");
  });

  it("names the day for an all-day task", () => {
    const allDay = new Date("2026-10-08T17:00:00Z");
    const message = taskReminderMessage({ taskId: "t", title: "Essay", dueAt: allDay, isAllDay: true, now: new Date("2026-10-08T02:00:00Z").getTime(), timeZone: TZ });
    expect(message.body).toBe("Due tomorrow.");
  });
});
