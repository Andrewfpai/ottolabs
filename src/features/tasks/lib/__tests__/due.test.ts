import { describe, expect, it } from "vitest";

import { zonedInstant } from "@/lib/time/calendar-day";

import { bucketFor, describeDue, groupOpenTasks } from "../due";

const TZ = "Asia/Jakarta";
const TODAY = "2026-10-02"; // a Friday
// 15:00 on Friday in Jakarta.
const NOW = zonedInstant(TODAY, "15:00", TZ).getTime();

function task(
  due: [string, string | null] | null,
  extra: Partial<{ priority: "p1" | "p2" | "p3"; createdAt: Date; id: string }> = {},
) {
  return {
    id: extra.id ?? "t",
    dueAt: due ? zonedInstant(due[0], due[1], TZ) : null,
    isAllDay: due ? due[1] === null : false,
    priority: extra.priority ?? "p3",
    createdAt: extra.createdAt ?? new Date("2026-09-01T00:00:00Z"),
  };
}

describe("bucketFor", () => {
  it("puts a task with no deadline in someday", () => {
    expect(bucketFor(task(null), TODAY, TZ)).toBe("someday");
  });

  it("splits on the calendar day in the user's zone", () => {
    expect(bucketFor(task(["2026-10-01", "23:59"]), TODAY, TZ)).toBe("overdue");
    expect(bucketFor(task(["2026-10-02", "00:00"]), TODAY, TZ)).toBe("today");
    expect(bucketFor(task(["2026-10-02", "23:59"]), TODAY, TZ)).toBe("today");
    expect(bucketFor(task(["2026-10-03", "00:00"]), TODAY, TZ)).toBe("upcoming");
  });

  it("keeps an all-day task in today for the whole day", () => {
    expect(bucketFor(task([TODAY, null]), TODAY, TZ)).toBe("today");
  });

  it("does not use UTC: 00:30 tomorrow is upcoming though it is still today in UTC", () => {
    // 00:30 on the 3rd in Jakarta is 17:30 UTC on the 2nd.
    expect(bucketFor(task(["2026-10-03", "00:30"]), TODAY, TZ)).toBe("upcoming");
  });
});

describe("groupOpenTasks", () => {
  it("orders dated groups by deadline, then priority, then age", () => {
    const later = task([TODAY, "18:00"], { id: "later" });
    const allDay = task([TODAY, null], { id: "all-day" });
    const urgentTie = task([TODAY, "18:00"], { id: "urgent", priority: "p1" });
    const olderTie = task([TODAY, "18:00"], {
      id: "older",
      createdAt: new Date("2026-08-01T00:00:00Z"),
    });

    const { today } = groupOpenTasks([later, allDay, urgentTie, olderTie], TODAY, TZ);
    expect(today.map((t) => t.id)).toEqual(["all-day", "urgent", "older", "later"]);
  });

  it("orders someday by priority, then newest first", () => {
    const old = task(null, { id: "old", createdAt: new Date("2026-01-01T00:00:00Z") });
    const fresh = task(null, { id: "fresh", createdAt: new Date("2026-09-30T00:00:00Z") });
    const urgent = task(null, { id: "urgent", priority: "p1" });

    const { someday } = groupOpenTasks([old, fresh, urgent], TODAY, TZ);
    expect(someday.map((t) => t.id)).toEqual(["urgent", "fresh", "old"]);
  });
});

describe("describeDue", () => {
  const describe_ = (due: [string, string | null]) => describeDue(task(due), NOW, TZ);

  it("returns nothing without a deadline", () => {
    expect(describeDue(task(null), NOW, TZ)).toBeNull();
  });

  it("counts overdue days", () => {
    expect(describe_(["2026-10-01", null])).toMatchObject({ text: "Yesterday", tone: "overdue" });
    expect(describe_(["2026-09-29", "10:00"])).toMatchObject({
      text: "3 days overdue",
      tone: "overdue",
    });
  });

  it("marks a timed deadline earlier today as late, but not an all-day one", () => {
    expect(describe_([TODAY, "09:00"])).toMatchObject({ text: "Today 09:00", tone: "overdue" });
    expect(describe_([TODAY, "18:00"])).toMatchObject({ text: "Today 18:00", tone: "today" });
    expect(describe_([TODAY, null])).toMatchObject({ text: "Today", tone: "today" });
  });

  it("names the next few days", () => {
    expect(describe_(["2026-10-03", null])).toMatchObject({ text: "Tomorrow", tone: "soon" });
    expect(describe_(["2026-10-05", "08:15"])).toMatchObject({ text: "Mon 08:15", tone: "soon" });
    expect(describe_(["2026-10-08", null])).toMatchObject({ text: "Thu", tone: "soon" });
  });

  it("falls back to a date a week or more out, with the year only when it differs", () => {
    expect(describe_(["2026-10-09", null])).toMatchObject({ text: "9 Oct", tone: "later" });
    expect(describe_(["2027-01-14", null])).toMatchObject({ text: "14 Jan 2027", tone: "later" });
  });

  it("gives the full date for screen readers", () => {
    expect(describe_(["2026-10-05", "08:15"])?.full).toBe("Monday, 5 October 2026 08:15");
  });
});
