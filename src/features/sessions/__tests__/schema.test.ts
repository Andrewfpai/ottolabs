import { describe, expect, it } from "vitest";

import { finishSessionSchema, startSessionSchema } from "../schema";

const TRACK = "8d3b5c2e-6a1f-4c3d-9e2b-1a2b3c4d5e6f";
const TASK = "1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b";

describe("startSessionSchema", () => {
  it("records to the track alone when no task is picked", () => {
    const parsed = startSessionSchema.parse({ trackId: TRACK });
    expect(parsed.taskId).toBeUndefined();
    expect(parsed.mode).toBe("stopwatch");
  });

  it("accepts a task id and rejects anything that is not one", () => {
    expect(startSessionSchema.parse({ trackId: TRACK, taskId: TASK }).taskId).toBe(TASK);
    expect(startSessionSchema.safeParse({ trackId: TRACK, taskId: "homework 1" }).success).toBe(false);
  });
});

describe("finishSessionSchema", () => {
  it("leaves the task open unless asked", () => {
    expect(finishSessionSchema.parse({ id: TRACK }).completeTask).toBe(false);
    expect(finishSessionSchema.parse({ id: TRACK, completeTask: true }).completeTask).toBe(true);
  });
});
