import { describe, it, expect } from "vitest";
import { runV3Checks } from "./checks-v3";
import { buildTestProject } from "./test-utils";

describe("checks-v3 · deep tier 2", () => {
  it("flags SSRF — fetch directly with request value", () => {
    const ctx = buildTestProject([
      {
        path: "app/api/proxy/route.ts",
        content: `export async function POST(req: Request) { const body = await req.json(); const r = await fetch(body.url); return new Response(await r.text()); }`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "security/ssrf")).toBe(true);
  });

  it("flags prototype pollution via Object.assign", () => {
    const ctx = buildTestProject([
      {
        path: "lib/x.ts",
        content: `function update(target: object, body: object) { return Object.assign(target, body); }`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "security/prototype-pollution"),
    ).toBe(true);
  });

  it("flags JWT none algorithm", () => {
    const ctx = buildTestProject([
      {
        path: "lib/auth.ts",
        content: `import jwt from 'jsonwebtoken'; jwt.verify(token, secret, { algorithms: ['none'] });`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "security/jwt-none-algorithm"),
    ).toBe(true);
  });

  it("flags hardcoded encryption key", () => {
    const ctx = buildTestProject([
      {
        path: "lib/x.ts",
        content: `import crypto from 'node:crypto'; const c = crypto.createCipheriv('aes-256-cbc', "myEncryptionKey32chars12345", iv);`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "security/hardcoded-encryption-key"),
    ).toBe(true);
  });

  it("flags timing-unsafe secret compare", () => {
    const ctx = buildTestProject([
      {
        path: "app/api/webhook/route.ts",
        content: `function verify(sig: string, expected: string) { if (sig === expected) return true; return false; }`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "security/timing-unsafe-compare"),
    ).toBe(true);
  });

  it("flags exposed debug route", () => {
    const ctx = buildTestProject([
      {
        path: "app/api/admin/debug/route.ts",
        content: `export async function GET() { return Response.json({ env: process.env }); }`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "security/exposed-debug-route"),
    ).toBe(true);
  });

  it("flags RegExp built from user input (ReDoS)", () => {
    const ctx = buildTestProject([
      {
        path: "app/api/search/route.ts",
        content: `export async function POST(req: Request) { const body = await req.json(); const re = new RegExp(body.pattern); return Response.json({}); }`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "security/regex-from-user-input"),
    ).toBe(true);
  });

  it("flags admin route without role check", () => {
    const ctx = buildTestProject([
      {
        path: "app/api/admin/users/route.ts",
        content: `export async function GET() { return Response.json({}); }`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(
      issues.some(
        (i) => i.checkId === "business_logic/admin-route-no-role-check",
      ),
    ).toBe(true);
  });

  it("flags webhook handler without dedup", () => {
    const ctx = buildTestProject([
      {
        path: "app/api/webhooks/razorpay/route.ts",
        content: `export async function POST(req: Request) { const event = await req.json(); await processPayment(event); return Response.json({}); }`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "reliability/webhook-no-dedup")).toBe(
      true,
    );
  });

  it("flags currency from client", () => {
    const ctx = buildTestProject([
      {
        path: "app/api/charge/route.ts",
        content: `import { stripe } from '@/lib/stripe'; export async function POST(req: Request) { const body = await req.json(); await stripe.charges.create({ amount: 1000, currency: body.currency }, { idempotencyKey: 'x' }); return Response.json({}); }`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "business_logic/currency-from-client"),
    ).toBe(true);
  });

  it("flags <img> tag inside app/", () => {
    const issues = runV3Checks(buildTestProject([]), [
      {
        path: "app/dashboard/page.tsx",
        content: `export default function Page() { return (<div><img src="/hero.png" /></div>); }`,
      },
    ]);
    expect(issues.some((i) => i.checkId === "performance/raw-img-tag")).toBe(
      true,
    );
  });

  it("flags fetch without AbortController", () => {
    const ctx = buildTestProject([
      {
        path: "lib/api.ts",
        content: `export async function getData() { const r = await fetch("https://api.example.com/x"); return r.json(); }`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "reliability/fetch-no-timeout")).toBe(
      true,
    );
  });

  it("does NOT flag fetch with signal", () => {
    const ctx = buildTestProject([
      {
        path: "lib/api.ts",
        content: `export async function getData() { const r = await fetch("https://api.example.com/x", { signal: AbortSignal.timeout(5000) }); return r.json(); }`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "reliability/fetch-no-timeout")).toBe(
      false,
    );
  });

  it("flags hallucinated import", () => {
    const files = [
      { path: "package.json", content: `{"dependencies":{"next":"15"}}` },
      {
        path: "lib/x.ts",
        content: `import { thing } from 'this-package-does-not-exist';\nexport const x = thing;`,
      },
    ];
    const ctx = buildTestProject(files);
    const issues = runV3Checks(ctx, files);
    expect(
      issues.some((i) => i.checkId === "ai_pattern/hallucinated-import"),
    ).toBe(true);
  });

  it("does NOT flag node builtins", () => {
    const files = [
      { path: "package.json", content: `{"dependencies":{"next":"15"}}` },
      {
        path: "lib/x.ts",
        content: `import crypto from 'node:crypto';\nimport fs from 'fs';\nexport const x = 1;`,
      },
    ];
    const ctx = buildTestProject(files);
    const issues = runV3Checks(ctx, files);
    expect(
      issues.some((i) => i.checkId === "ai_pattern/hallucinated-import"),
    ).toBe(false);
  });

  it("flags env var typo (SUPABSE_URL)", () => {
    const ctx = buildTestProject([
      {
        path: "lib/x.ts",
        content: `const u = process.env.SUPABSE_URL;`,
      },
    ]);
    const issues = runV3Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "ai_pattern/env-var-typo")).toBe(
      true,
    );
  });

  it("flags missing robots when public app exists", () => {
    const files = [{ path: "app/pricing/page.tsx", content: `export default function P(){return null}` }];
    const ctx = buildTestProject(files);
    const issues = runV3Checks(ctx, files);
    expect(issues.some((i) => i.checkId === "deploy_readiness/missing-robots")).toBe(
      true,
    );
  });

  it("flags missing health endpoint when other api routes exist", () => {
    const files = [
      {
        path: "app/api/users/route.ts",
        content: `export async function GET() { return Response.json({}); }`,
      },
    ];
    const ctx = buildTestProject(files);
    const issues = runV3Checks(ctx, files);
    expect(issues.some((i) => i.checkId === "deploy_readiness/no-health-endpoint")).toBe(
      true,
    );
  });

  it("flags productionBrowserSourceMaps: true", () => {
    const files = [
      {
        path: "next.config.ts",
        content: `const config = { productionBrowserSourceMaps: true }; export default config;`,
      },
    ];
    const ctx = buildTestProject(files);
    const issues = runV3Checks(ctx, files);
    expect(
      issues.some((i) => i.checkId === "security/production-source-maps"),
    ).toBe(true);
  });
});
