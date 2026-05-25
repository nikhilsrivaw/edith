/**
 * Smoke tests for the v2 checks. Builds a tiny ts-morph project per case
 * and asserts the right check_id fires (or doesn't).
 */
import { describe, it, expect } from "vitest";
import { Project, ScriptTarget, ModuleKind, ModuleResolutionKind } from "ts-morph";
import { runV2Checks } from "./checks-v2";
import type { FetchedFile } from "./github-tree";

function build(files: FetchedFile[]) {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      target: ScriptTarget.ES2022,
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.Bundler,
      jsx: 4,
      allowJs: true,
      esModuleInterop: true,
      strict: false,
      noEmit: true,
      skipLibCheck: true,
    },
  });
  const fileMap = new Map<string, FetchedFile>();
  for (const f of files) {
    fileMap.set(f.path, f);
    if (/\.(tsx?|jsx?|mjs|cjs)$/.test(f.path)) {
      try {
        project.createSourceFile("/" + f.path, f.content, { overwrite: true });
      } catch {
        /* */
      }
    }
  }
  return {
    project,
    fileMap,
    tsFiles: files.filter((f) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f.path)),
  };
}

describe("checks-v2", () => {
  it("flags eval()", () => {
    const ctx = build([
      { path: "lib/x.ts", content: `eval("alert(1)");` },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "security/eval-call")).toBe(true);
  });

  it("flags new Function(...)", () => {
    const ctx = build([
      { path: "lib/x.ts", content: `const f = new Function("return 1");` },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "security/function-constructor")).toBe(true);
  });

  it("flags hardcoded JWT secret in jwt.sign", () => {
    const ctx = build([
      {
        path: "lib/auth.ts",
        content: `import jwt from 'jsonwebtoken';\nexport const t = jwt.sign({u:1}, "Ng9p2!sX@vBnQrTuWxZ", {expiresIn:'1d'});`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "security/hardcoded-jwt-secret"),
    ).toBe(true);
  });

  it("flags md5 used for password", () => {
    const ctx = build([
      {
        path: "lib/users.ts",
        content: `import crypto from 'node:crypto';\nfunction hashPassword(password: string) { return crypto.createHash("md5").update(password).digest("hex"); }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "security/weak-password-hash")).toBe(
      true,
    );
  });

  it("flags Math.random used for token", () => {
    const ctx = build([
      {
        path: "lib/t.ts",
        content: `function makeSessionToken() { const token = Math.random().toString(36).slice(2); return token; }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "security/insecure-random-for-token"),
    ).toBe(true);
  });

  it("does NOT flag Math.random in unrelated context", () => {
    const ctx = build([
      {
        path: "lib/anim.ts",
        content: `function jitter(): number { return Math.random() * 100; }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "security/insecure-random-for-token"),
    ).toBe(false);
  });

  it("flags req.json() without zod/valibot in API route", () => {
    const ctx = build([
      {
        path: "app/api/users/route.ts",
        content: `export async function POST(req: Request) { const body = await req.json(); return Response.json({ok:true}); }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "data_safety/no-input-validation"),
    ).toBe(true);
  });

  it("does NOT flag when zod is imported and parse is used", () => {
    const ctx = build([
      {
        path: "app/api/users/route.ts",
        content: `import { z } from 'zod';\nconst S = z.object({ name: z.string() });\nexport async function POST(req: Request) { const body = S.parse(await req.json()); return Response.json({ok:true}); }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "data_safety/no-input-validation"),
    ).toBe(false);
  });

  it("flags auth route without rate limiting", () => {
    const ctx = build([
      {
        path: "app/api/auth/login/route.ts",
        content: `export async function POST(req: Request) { return Response.json({ok:true}); }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "security/auth-no-rate-limit")).toBe(
      true,
    );
  });

  it("flags SQL string concat", () => {
    const ctx = build([
      {
        path: "lib/db.ts",
        content: `async function findUser(id: string) { return db.query("SELECT * FROM users WHERE id=" + id); }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "data_safety/sql-string-concat")).toBe(
      true,
    );
  });

  it("flags fs.readFile with req-derived path", () => {
    const ctx = build([
      {
        path: "app/api/files/route.ts",
        content: `import fs from 'node:fs'; export async function GET(req: Request) { const data = fs.readFileSync(req.url); return new Response(data); }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "security/path-traversal")).toBe(true);
  });

  it("flags Stripe charge without idempotency key", () => {
    const ctx = build([
      {
        path: "app/api/charge/route.ts",
        content: `import { stripe } from '@/lib/stripe'; export async function POST() { await stripe.charges.create({ amount: 1000, currency: 'usd' }); return Response.json({}); }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(
      issues.some((i) => i.checkId === "business_logic/stripe-no-idempotency"),
    ).toBe(true);
  });

  it("flags Stripe charge with amount from req.body", () => {
    const ctx = build([
      {
        path: "app/api/charge/route.ts",
        content: `import { stripe } from '@/lib/stripe'; export async function POST(req: Request) { const body = await req.json(); await stripe.charges.create({ amount: body.amount, currency: 'usd' }, { idempotencyKey: 'x' }); return Response.json({}); }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(
      issues.some(
        (i) => i.checkId === "business_logic/payment-amount-from-client",
      ),
    ).toBe(true);
  });

  it("flags DB query awaited inside a loop", () => {
    const ctx = build([
      {
        path: "lib/x.ts",
        content: `async function getAll(ids: string[]) { for (const id of ids) { await db.query("select 1"); } }`,
      },
    ]);
    const issues = runV2Checks(ctx, []);
    expect(issues.some((i) => i.checkId === "performance/db-query-in-loop")).toBe(
      true,
    );
  });

  it("flags missing error tracking in package.json", () => {
    const issues = runV2Checks(
      build([{ path: "package.json", content: `{"dependencies":{"next":"15"}}` }]),
      [{ path: "package.json", content: `{"dependencies":{"next":"15"}}` }],
    );
    expect(issues.some((i) => i.checkId === "deploy_readiness/no-error-tracking")).toBe(
      true,
    );
  });

  it("does NOT flag when @sentry is in deps", () => {
    const files: FetchedFile[] = [
      {
        path: "package.json",
        content: `{"dependencies":{"@sentry/nextjs":"10"}}`,
      },
    ];
    const issues = runV2Checks(build(files), files);
    expect(issues.some((i) => i.checkId === "deploy_readiness/no-error-tracking")).toBe(
      false,
    );
  });
});
