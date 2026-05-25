import { describe, it, expect } from "vitest";
import { runSecretChecks } from "./checks-secrets";

/**
 * Fixtures here intentionally LOOK like real provider keys at runtime
 * because that's what we're asserting the scanner detects. They MUST
 * NOT appear as literal `sk_live_…` / `AKIA…16chars` / `sk-ant-…`
 * strings in source though, or GitHub's secret-scanning push-protection
 * blocks the repo. So we assemble them from harmless parts at runtime.
 *
 * Helper: returns the joined string only inside the test. The static
 * scanners GitHub runs on push see the parts, not the assembled value.
 */
const j = (...parts: string[]) => parts.join("");

const STRIPE_LIVE = j("sk", "_live_", "A".repeat(28));
const STRIPE_LIVE_ALT = j("sk", "_live_", "TESTKEY".repeat(4), "12");
const AWS_KEY = j("AKIA", "IOSFODNN7", "EXAMPLE");
const ANTHROPIC_KEY = j("sk-", "ant-", "a".repeat(40));

describe("checks-secrets · live key detection", () => {
  it("detects Stripe live secret key", () => {
    const issues = runSecretChecks([
      {
        path: "lib/stripe.ts",
        content: `const sk = "${STRIPE_LIVE}";`,
      },
    ]);
    expect(issues.length).toBe(1);
    expect(issues[0].checkId).toContain("stripe-live-secret-key");
    expect(issues[0].severity).toBe("critical");
  });

  it("redacts the actual key value", () => {
    const issues = runSecretChecks([
      { path: "lib/stripe.ts", content: `const sk = "${STRIPE_LIVE_ALT}";` },
    ]);
    expect(issues[0].codeSnippet).not.toContain(STRIPE_LIVE_ALT);
    expect(issues[0].codeSnippet).toContain("…");
  });

  it("detects AWS access keys", () => {
    const issues = runSecretChecks([
      { path: ".env", content: `AWS_ACCESS_KEY_ID=${AWS_KEY}` },
    ]);
    expect(
      issues.some((i) => i.checkId.includes("aws-access-key-id")),
    ).toBe(true);
  });

  it("detects Anthropic keys", () => {
    const issues = runSecretChecks([
      {
        path: "config.js",
        content: `process.env.ANTHROPIC = "${ANTHROPIC_KEY}"`,
      },
    ]);
    expect(
      issues.some((i) => i.checkId.includes("anthropic-api-key")),
    ).toBe(true);
  });

  it("skips node_modules + build artifacts", () => {
    const issues = runSecretChecks([
      {
        path: "node_modules/foo/bar.js",
        content: `const k = "${j("sk", "_live_", "A".repeat(24))}"`,
      },
      {
        path: ".next/static/chunks/x.js",
        content: `const k = "${j("sk", "_live_", "B".repeat(24))}"`,
      },
    ]);
    expect(issues.length).toBe(0);
  });

  it("returns no issues for clean files", () => {
    const issues = runSecretChecks([
      { path: "README.md", content: "# Hello world" },
      {
        path: "lib/x.ts",
        content: "export const FOO = 'just a normal string';",
      },
    ]);
    expect(issues.length).toBe(0);
  });
});
