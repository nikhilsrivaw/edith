import { describe, it, expect } from "vitest";
import { PLAN_LIMITS } from "./plan-limits";

describe("plan limits matrix", () => {
  it("free is the most restrictive", () => {
    const free = PLAN_LIMITS.free;
    expect(free.repos).toBeGreaterThan(0);
    expect(free.repos).toBeLessThan(PLAN_LIMITS.builder.repos);
    expect(free.runtimeProbes).toBe(false);
    expect(free.customRules).toBe(false);
  });

  it("pro unlocks paid features", () => {
    const pro = PLAN_LIMITS.pro;
    expect(pro.runtimeProbes).toBe(true);
    expect(pro.customRules).toBe(true);
    expect(pro.repos).toBe(-1); // unlimited
    expect(pro.scansPerMonth).toBe(-1);
  });

  it("agency adds workspaces + white-label", () => {
    const agency = PLAN_LIMITS.agency;
    expect(agency.whiteLabel).toBe(true);
    expect(agency.clientWorkspaces).toBe(true);
  });

  it("builder upgrades free's frequency and adds slack", () => {
    expect(PLAN_LIMITS.builder.scanFrequency).toBe("daily");
    expect(PLAN_LIMITS.builder.slackDigest).toBe(true);
    expect(PLAN_LIMITS.free.slackDigest).toBe(false);
  });
});
