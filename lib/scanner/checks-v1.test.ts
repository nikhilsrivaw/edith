import { describe, it, expect } from "vitest";
import { runV1Checks } from "./checks-v1";
import { buildTestProject } from "./test-utils";

describe("checks-v1 · AST + cross-file", () => {
  it("flags process.env.X not in .env.example", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "lib/db.ts",
          content: `const url = process.env.DATABASE_URL;`,
        },
        { path: ".env.example", content: "NODE_ENV=" },
      ]),
    );
    expect(
      issues.some(
        (i) => i.checkId === "deploy_readiness/env-var-undocumented",
      ),
    ).toBe(true);
  });

  it("does NOT flag process.env.X when declared in .env.example", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "lib/db.ts",
          content: `const url = process.env.DATABASE_URL;`,
        },
        { path: ".env.example", content: "DATABASE_URL=\nNODE_ENV=" },
      ]),
    );
    expect(
      issues.some(
        (i) => i.checkId === "deploy_readiness/env-var-undocumented",
      ),
    ).toBe(false);
  });

  it("skips NEXT_PUBLIC_ env vars (those are intentionally bundled)", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "components/x.tsx",
          content: `const url = process.env.NEXT_PUBLIC_APP_URL;`,
        },
      ]),
    );
    expect(
      issues.some(
        (i) => i.checkId === "deploy_readiness/env-var-undocumented",
      ),
    ).toBe(false);
  });

  it("flags `as any` casts", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "lib/x.ts",
          content: `const data = JSON.parse("{}") as any;`,
        },
      ]),
    );
    expect(
      issues.some((i) => i.checkId === "reliability/type-erasure-any"),
    ).toBe(true);
  });

  it("flags @ts-ignore comments", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "lib/x.ts",
          content: `// @ts-ignore\nconst x = undefinedThing();`,
        },
      ]),
    );
    expect(
      issues.some(
        (i) => i.checkId === "reliability/ts-ignore-suppression",
      ),
    ).toBe(true);
  });

  it("flags async callback in forEach", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "lib/x.ts",
          content: `const items = [1,2,3]; items.forEach(async (n) => { await Promise.resolve(n); });`,
        },
      ]),
    );
    expect(
      issues.some((i) => i.checkId === "reliability/async-in-foreach"),
    ).toBe(true);
  });

  it("flags POST route without auth pattern", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "app/api/users/route.ts",
          content: `export async function POST(req: Request) { return Response.json({ok:true}); }`,
        },
      ]),
    );
    expect(
      issues.some((i) => i.checkId === "security/route-auth-missing"),
    ).toBe(true);
  });

  it("does NOT flag POST route with supabase.auth.getUser", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "app/api/users/route.ts",
          content: `import { getSupabaseServer } from '@/lib/supabase-server';\nexport async function POST(req: Request) { const s = await getSupabaseServer(); const { data: { user } } = await s.auth.getUser(); return Response.json({ok:true}); }`,
        },
      ]),
    );
    expect(
      issues.some((i) => i.checkId === "security/route-auth-missing"),
    ).toBe(false);
  });

  it("skips webhook routes (auth is via signature)", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "app/api/webhooks/stripe/route.ts",
          content: `export async function POST(req: Request) { return Response.json({ok:true}); }`,
        },
      ]),
    );
    expect(
      issues.some((i) => i.checkId === "security/route-auth-missing"),
    ).toBe(false);
  });

  it("flags Stripe webhook missing constructEvent (AST variant)", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "app/api/webhooks/stripe/route.ts",
          content: `import Stripe from 'stripe';\nconst stripe = new Stripe('sk');\nexport async function POST(req: Request) { const body = await req.json(); return Response.json({ok:true}); }`,
        },
      ]),
    );
    expect(
      issues.some(
        (i) => i.checkId === "security/stripe-webhook-signature-ast",
      ),
    ).toBe(true);
  });

  it("flags SQL injection via template literal", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "lib/x.ts",
          content: `async function getUser(id: string) { return db.query(\`SELECT * FROM users WHERE id='\${id}'\`); }`,
        },
      ]),
    );
    expect(
      issues.some(
        (i) => i.checkId === "data_safety/sql-injection-template",
      ),
    ).toBe(true);
  });

  it("flags RLS not enabled on created table", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "supabase/migrations/0001_x.sql",
          content: `create table public.orders (id uuid primary key, user_id uuid);`,
        },
      ]),
    );
    expect(
      issues.some((i) => i.checkId === "data_safety/rls-not-enabled"),
    ).toBe(true);
  });

  it("flags RLS enabled but no policy", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "supabase/migrations/0001_x.sql",
          content: `create table public.orders (id uuid primary key);\nalter table public.orders enable row level security;`,
        },
      ]),
    );
    expect(
      issues.some(
        (i) => i.checkId === "data_safety/rls-enabled-no-policy",
      ),
    ).toBe(true);
  });

  it("does NOT flag tables with both RLS and policy", () => {
    const issues = runV1Checks(
      buildTestProject([
        {
          path: "supabase/migrations/0001_x.sql",
          content: `create table public.orders (id uuid primary key);\nalter table public.orders enable row level security;\ncreate policy "x" on public.orders for select using (true);`,
        },
      ]),
    );
    expect(
      issues.some((i) =>
        i.checkId.startsWith("data_safety/rls-"),
      ),
    ).toBe(false);
  });
});
