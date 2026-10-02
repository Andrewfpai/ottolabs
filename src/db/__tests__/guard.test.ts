import { describe, expect, it } from "vitest";

import { endpointOf, isProductionDatabase } from "../guard";

const pooled = "postgresql://u:p@ep-plain-frost-azr6kunz-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const direct = "postgresql://u:p@ep-plain-frost-azr6kunz.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const dev = "postgresql://u:p@ep-broad-resonance-azh5akwd-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb";

describe("endpointOf", () => {
  it("reads the Neon endpoint from pooled and direct URLs alike", () => {
    expect(endpointOf(pooled)).toBe("ep-plain-frost-azr6kunz");
    expect(endpointOf(direct)).toBe("ep-plain-frost-azr6kunz");
  });

  it("returns null for nothing or nonsense", () => {
    expect(endpointOf(undefined)).toBeNull();
    expect(endpointOf("not a url")).toBeNull();
  });
});

describe("isProductionDatabase", () => {
  it("matches production however the endpoint is written", () => {
    expect(isProductionDatabase(pooled, "ep-plain-frost-azr6kunz")).toBe(true);
    expect(isProductionDatabase(direct, " ep-plain-frost-azr6kunz-pooler ")).toBe(true);
  });

  it("does not match another branch", () => {
    expect(isProductionDatabase(dev, "ep-plain-frost-azr6kunz")).toBe(false);
  });

  it("cannot decide without a production endpoint, so says no", () => {
    expect(isProductionDatabase(pooled, undefined)).toBe(false);
    expect(isProductionDatabase(pooled, "")).toBe(false);
  });
});
