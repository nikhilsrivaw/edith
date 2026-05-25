import { describe, it, expect } from "vitest";
import { runAllChecks } from "./checks-v0";

describe("checks-v0 · regex scanners", () => {
  it("flags missing Stripe webhook signature verification", async () => {
    const files = [
      {
        path: "app/api/webhooks/stripe/route.ts",
        content:
          'export async function POST(req: Request) { const body = await req.json(); return Response.json({}); }',
      },
    ];
    const issues = await runAllChecks({ files });
    const hit = issues.find(
      (i) => i.checkId === "security/stripe-webhook-signature",
    );
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("critical");
  });

  it("does NOT flag webhook when constructEvent is present", async () => {
    const files = [
      {
        path: "app/api/webhooks/stripe/route.ts",
        content:
          'import { stripe } from "@/lib/stripe";\nconst event = stripe.webhooks.constructEvent(body, sig, secret);',
      },
    ];
    const issues = await runAllChecks({ files });
    expect(
      issues.find((i) => i.checkId === "security/stripe-webhook-signature"),
    ).toBeUndefined();
  });

  it("flags missing .env.example", async () => {
    const files = [{ path: "package.json", content: "{}" }];
    const issues = await runAllChecks({ files });
    expect(
      issues.some((i) => i.checkId === "deploy_readiness/no-env-example"),
    ).toBe(true);
  });

  it("flags missing health-check endpoint", async () => {
    const files = [{ path: "package.json", content: "{}" }];
    const issues = await runAllChecks({ files });
    expect(
      issues.some((i) => i.checkId === "deploy_readiness/no-health-check"),
    ).toBe(true);
  });

  it("flags table without RLS in migration", async () => {
    const files = [
      {
        path: "supabase/migrations/0001_init.sql",
        content: "create table public.orders (id uuid primary key);",
      },
    ];
    const issues = await runAllChecks({ files });
    expect(issues.some((i) => i.checkId === "data_safety/missing-rls")).toBe(
      true,
    );
  });

  it("does NOT flag RLS when enable row level security present", async () => {
    const files = [
      {
        path: "supabase/migrations/0001_init.sql",
        content:
          "create table public.orders (id uuid);\nalter table public.orders enable row level security;",
      },
    ];
    const issues = await runAllChecks({ files });
    expect(issues.some((i) => i.checkId === "data_safety/missing-rls")).toBe(
      false,
    );
  });

  it("flags webhook handler without idempotency keyword", async () => {
    const files = [
      {
        path: "app/api/webhooks/razorpay/route.ts",
        content: "export async function POST() { return new Response(); }",
      },
    ];
    const issues = await runAllChecks({ files });
    expect(
      issues.some((i) => i.checkId === "reliability/webhook-no-idempotency"),
    ).toBe(true);
  });
});
