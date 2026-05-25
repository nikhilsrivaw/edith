/**
 * AST-based + cross-file checks (Layer 1 + Layer 2 of the bible).
 *
 * Each check is a separate function. They share a context (project + file
 * map) so multi-file invariants can be expressed naturally.
 *
 * Style: tight, focused. Each check returns CheckIssue[].
 */
import "server-only";
import { Node, SourceFile } from "ts-morph";
import type { Dimension, Severity } from "../mock-data";
import type { RepoProject } from "./project";

export type CheckIssue = {
  checkId: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
};

export type V1Context = RepoProject;

export function runV1Checks(ctx: V1Context): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const checks = [
    checkEnvVarTripleCheck,
    checkAsAnyCasts,
    checkTsIgnoreSuppressions,
    checkAsyncInForEach,
    checkRouteAuthMissing,
    checkStripeWebhookAst,
    checkSqlInjectionTaint,
    checkRlsCoverage,
  ];
  for (const c of checks) {
    try {
      issues.push(...c(ctx));
    } catch (err) {
      console.error(`[checks-v1] ${c.name} crashed:`, err);
    }
  }
  return issues;
}

/* =============== Helpers =============== */

function rel(path: string) {
  return path.startsWith("/") ? path.slice(1) : path;
}

function lineOf(sf: SourceFile, pos: number): number {
  try {
    return sf.getLineAndColumnAtPos(pos).line;
  } catch {
    return 1;
  }
}

function isAppApiRouteFile(path: string): boolean {
  return /(^|\/)app\/api\/.+\/route\.tsx?$/.test(rel(path));
}

function hasAnyImport(sf: SourceFile, modulePatterns: RegExp[]): boolean {
  for (const imp of sf.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (modulePatterns.some((r) => r.test(spec))) return true;
  }
  return false;
}

/* =============== 1. Env var triple-check =============== */

function checkEnvVarTripleCheck(ctx: V1Context): CheckIssue[] {
  const BUILTIN = new Set([
    "NODE_ENV",
    "VERCEL",
    "VERCEL_URL",
    "VERCEL_ENV",
    "VERCEL_GIT_COMMIT_SHA",
    "PORT",
    "PWD",
    "HOME",
    "PATH",
  ]);

  // Collect all referenced process.env.X across the project.
  type Ref = { name: string; sf: SourceFile; line: number };
  const refs: Ref[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isPropertyAccessExpression(node)) return;
      const obj = node.getExpression();
      if (!Node.isPropertyAccessExpression(obj)) return;
      const left = obj.getExpression().getText();
      const mid = obj.getName();
      if (left !== "process" || mid !== "env") return;
      const name = node.getName();
      refs.push({ name, sf, line: lineOf(sf, node.getStart()) });
    });
  }
  if (refs.length === 0) return [];

  // Parse .env.example if present.
  const envExample = [...ctx.fileMap.values()].find((f) =>
    /(^|\/)\.env\.example$/.test(f.path),
  );
  const declared = new Set<string>();
  if (envExample) {
    for (const line of envExample.content.split("\n")) {
      const m = line.trim().match(/^#?\s*([A-Z_][A-Z0-9_]*)=/);
      if (m && !line.trim().startsWith("#")) declared.add(m[1]);
    }
  }

  // Group by var name so we report each once at the first reference.
  const seen = new Set<string>();
  const issues: CheckIssue[] = [];
  for (const r of refs) {
    if (BUILTIN.has(r.name)) continue;
    if (r.name.startsWith("NEXT_PUBLIC_")) continue;
    if (declared.has(r.name)) continue;
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    issues.push({
      checkId: "deploy_readiness/env-var-undocumented",
      dimension: "deploy_readiness",
      severity: envExample ? "medium" : "low",
      title: `process.env.${r.name} not in .env.example`,
      description: envExample
        ? `${r.name} is read from the environment but not declared in .env.example. New contributors and CI will silently fail on missing config. Add a line "${r.name}=" (no value) to .env.example.`
        : `${r.name} is read from the environment but there's no .env.example to declare it in. Add one — it's the cheapest way to document required config.`,
      filePath: rel(r.sf.getFilePath()),
      lineNumber: r.line,
    });
  }
  return issues;
}

/* =============== 2. `as any` casts =============== */

function checkAsAnyCasts(ctx: V1Context): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = sf.getFilePath();
    if (path.includes("/scripts/") || path.includes("/test/")) continue;
    sf.forEachDescendant((node) => {
      if (!Node.isAsExpression(node)) return;
      const typeText = node.getTypeNode()?.getText().trim();
      if (typeText !== "any") return;
      issues.push({
        checkId: "reliability/type-erasure-any",
        dimension: "reliability",
        severity: "low",
        title: "`as any` cast erases type safety",
        description:
          "An `as any` cast silently bypasses TypeScript's type system. Each one is a place where a real type error could ship to production unnoticed. Replace with a precise type, or `unknown` + a runtime validator (zod, valibot).",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: node.getText().slice(0, 160),
      });
    });
  }
  return issues;
}

/* =============== 3. @ts-ignore / @ts-expect-error =============== */

function checkTsIgnoreSuppressions(ctx: V1Context): CheckIssue[] {
  const re = /@ts-(?:ignore|expect-error|nocheck)\b/;
  const issues: CheckIssue[] = [];
  for (const f of ctx.tsFiles) {
    const lines = f.content.split("\n");
    lines.forEach((ln, i) => {
      if (re.test(ln)) {
        issues.push({
          checkId: "reliability/ts-ignore-suppression",
          dimension: "reliability",
          severity: "low",
          title: "Type error suppressed with @ts-ignore",
          description:
            "A type error was silenced rather than fixed. Each suppression is a place where the type system promised something untrue. Remove the comment and fix the underlying type.",
          filePath: rel(f.path),
          lineNumber: i + 1,
          codeSnippet: ln.trim().slice(0, 200),
        });
      }
    });
  }
  return issues;
}

/* =============== 4. Async function in forEach (await lost) =============== */

function checkAsyncInForEach(ctx: V1Context): CheckIssue[] {
  // Pattern: arr.forEach(async (...) => { ... await ... });
  // forEach ignores returned promises, so awaits inside never block the outer flow.
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return;
      if (expr.getName() !== "forEach") return;
      const args = node.getArguments();
      if (args.length === 0) return;
      const cb = args[0];
      if (
        !Node.isArrowFunction(cb) &&
        !Node.isFunctionExpression(cb)
      )
        return;
      const isAsync = cb
        .getModifiers()
        .some((m) => m.getText() === "async");
      if (!isAsync) return;
      issues.push({
        checkId: "reliability/async-in-foreach",
        dimension: "reliability",
        severity: "high",
        title: "`async` callback passed to `.forEach`",
        description:
          ".forEach ignores returned promises — the awaits inside never block the outer flow. Order is unguaranteed, errors are swallowed, and the surrounding function returns before any of these promises settle. Use `for…of` with await, or `Promise.all(arr.map(async …))` if you want concurrency.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: node.getText().slice(0, 200),
      });
    });
  }
  return issues;
}

/* =============== 5. Route handlers missing auth =============== */

function checkRouteAuthMissing(ctx: V1Context): CheckIssue[] {
  const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const AUTH_PATTERNS = [
    /\.auth\.(getUser|getSession)\(/,    // supabase, custom clients via destructured var
    /getServerSession\b/,
    /currentUser\(\)/,
    /auth\(\)\.protect/,
    /requireAuth\b/,
    /\bclerk\b/i,
    /\bgetAuth\b/,
    /\bvalidateRequest\b/,
    /getSupabaseServer/,                 // common in this very project
  ];
  // Webhook endpoints are auth'd by signature, not session — skip.
  const isWebhook = (p: string) => /\/webhooks?\//.test(p);

  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!isAppApiRouteFile(path)) continue;
    if (isWebhook(path)) continue;

    const exported = new Set<string>();
    for (const fn of sf.getFunctions()) {
      if (fn.isExported()) exported.add(fn.getName() ?? "");
    }
    for (const decl of sf.getVariableStatements()) {
      if (!decl.isExported()) continue;
      for (const d of decl.getDeclarations()) {
        exported.add(d.getName());
      }
    }
    const mutating = [...exported].filter((n) => MUTATIONS.has(n));
    if (mutating.length === 0) continue;

    const sourceText = sf.getFullText();
    const hasAuth = AUTH_PATTERNS.some((re) => re.test(sourceText));
    if (hasAuth) continue;

    issues.push({
      checkId: "security/route-auth-missing",
      dimension: "security",
      severity: "critical",
      title: `${path} exports mutating methods (${mutating.join(
        ", ",
      )}) without an auth check`,
      description: `The route handler exports ${mutating.join(
        ", ",
      )} but no auth/session check was found in the source. Anyone with the URL can call this route. Add a session check at the top of each mutating handler (supabase.auth.getUser, getServerSession, etc.) or route the auth check through middleware/proxy.ts.`,
      filePath: path,
      lineNumber: 1,
    });
  }
  return issues;
}

/* =============== 6. Stripe webhook constructEvent (AST) =============== */

function checkStripeWebhookAst(ctx: V1Context): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!/app\/api\/webhooks\/stripe\/route\.tsx?$/.test(path)) continue;
    const importsStripe = hasAnyImport(sf, [/^stripe$/, /@\/lib\/stripe$/]);
    if (!importsStripe) continue;
    const text = sf.getFullText();
    if (/\.webhooks\.constructEvent\s*\(/.test(text)) continue;
    issues.push({
      checkId: "security/stripe-webhook-signature-ast",
      dimension: "security",
      severity: "critical",
      title: "Stripe webhook handler missing signature verification",
      description:
        "This file imports Stripe but never calls stripe.webhooks.constructEvent. Without that call the route trusts whatever JSON body is POSTed — attackers can forge events to mark orders as paid. Verify the Stripe-Signature header against your STRIPE_WEBHOOK_SECRET.",
      filePath: path,
      lineNumber: 1,
    });
  }
  return issues;
}

/* =============== 7. SQL injection via template literal =============== */

function checkSqlInjectionTaint(ctx: V1Context): CheckIssue[] {
  const issues: CheckIssue[] = [];
  // db.query / pool.query / sql.unsafe / .raw / postgres.unsafe etc.
  const DANGEROUS_CALLEES = /\b(query|raw|unsafe|exec)\b/;
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      const calleeName = Node.isPropertyAccessExpression(expr)
        ? expr.getName()
        : expr.getText();
      if (!DANGEROUS_CALLEES.test(calleeName)) return;
      const arg = node.getArguments()[0];
      if (!arg) return;
      if (!Node.isTemplateExpression(arg)) return;
      // Has at least one ${} interpolation
      const spans = arg.getTemplateSpans();
      if (spans.length === 0) return;
      // Heuristic: if the SQL keyword appears in the head, this is likely a
      // raw SQL string. Otherwise it might be a tagged sql template (safe).
      const head = arg.getHead().getText();
      if (!/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(head)) return;

      issues.push({
        checkId: "data_safety/sql-injection-template",
        dimension: "data_safety",
        severity: "critical",
        title: "Raw SQL with template-literal interpolation",
        description:
          "User-controlled values appear to be interpolated directly into a raw SQL string. Use parameterised queries (db.query(text, [values])) or a query builder. If you must interpolate, validate strictly first.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: arg.getText().slice(0, 240),
      });
    });
  }
  return issues;
}

/* =============== 8. RLS coverage on supabase migrations =============== */

function checkRlsCoverage(ctx: V1Context): CheckIssue[] {
  const sqlFiles = [...ctx.fileMap.values()].filter((f) =>
    /(^|\/)supabase\/migrations\/.+\.sql$/.test(f.path),
  );
  if (sqlFiles.length === 0) return [];

  const created = new Set<string>();
  const rlsEnabled = new Set<string>();
  const policied = new Set<string>();

  for (const f of sqlFiles) {
    const sql = f.content;
    // create table public.foo ( ... )
    const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi;
    let m;
    while ((m = createRe.exec(sql)) !== null) created.add(m[1]);

    const enableRe = /alter\s+table\s+public\.([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi;
    while ((m = enableRe.exec(sql)) !== null) rlsEnabled.add(m[1]);

    const policyRe = /create\s+policy\b[^;]+\bon\s+public\.([a-z_][a-z0-9_]*)/gi;
    while ((m = policyRe.exec(sql)) !== null) policied.add(m[1]);
  }

  const issues: CheckIssue[] = [];
  for (const tbl of created) {
    if (!rlsEnabled.has(tbl)) {
      const f = sqlFiles.find((f) => new RegExp(`public\\.${tbl}\\b`, "i").test(f.content))!;
      issues.push({
        checkId: "data_safety/rls-not-enabled",
        dimension: "data_safety",
        severity: "critical",
        title: `Table public.${tbl} has no \`enable row level security\``,
        description: `The table public.${tbl} was created but never had RLS enabled. With anon-key access this means total read of every row. Add: \`alter table public.${tbl} enable row level security;\` and at least one policy.`,
        filePath: rel(f.path),
        lineNumber: 1,
      });
    } else if (!policied.has(tbl)) {
      const f = sqlFiles.find((f) => new RegExp(`public\\.${tbl}\\b`, "i").test(f.content))!;
      issues.push({
        checkId: "data_safety/rls-enabled-no-policy",
        dimension: "data_safety",
        severity: "high",
        title: `Table public.${tbl} has RLS enabled but no policy`,
        description: `RLS is on for public.${tbl} but no \`create policy\` was found. With RLS on and no policy, the anon key returns zero rows — your queries silently 404. Add a policy that defines who can read/write.`,
        filePath: rel(f.path),
        lineNumber: 1,
      });
    }
  }
  return issues;
}
