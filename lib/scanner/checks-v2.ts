/**
 * v2 checks — broader security + business-logic + reliability + performance.
 *
 * Each check is deterministic (no LLM), conservative on false positives,
 * and mapped to at least one compliance control in 0006_v2_compliance.sql.
 *
 * Style: short, focused. Most are AST-based; a few use regex when AST adds
 * no real precision over plain text matching.
 */
import "server-only";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { Dimension, Severity } from "../mock-data";
import type { RepoProject } from "./project";
import type { FetchedFile } from "./github-tree";

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

const rel = (p: string) => (p.startsWith("/") ? p.slice(1) : p);
const lineOf = (sf: SourceFile, pos: number) => {
  try {
    return sf.getLineAndColumnAtPos(pos).line;
  } catch {
    return 1;
  }
};
const snip = (s: string, n = 160) => s.slice(0, n);

/* ───────────── 1. Hardcoded JWT secret ───────────── */

function checkHardcodedJwtSecret(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression().getText();
      if (!/\b(sign|verify|jwt)\b/i.test(callee)) return;
      const args = node.getArguments();
      const secretArg = args[1];
      if (!secretArg || !Node.isStringLiteral(secretArg)) return;
      const val = secretArg.getLiteralText();
      if (val.length < 8 || val.length > 256) return;
      // Skip obvious placeholders.
      if (/your[-_]?secret|change[-_]?me|example/i.test(val)) return;
      issues.push({
        checkId: "security/hardcoded-jwt-secret",
        dimension: "security",
        severity: "critical",
        title: "Hardcoded JWT secret in source",
        description:
          "A JWT signing/verifying call uses an inline string literal as the secret. Anyone with read access to the repo can forge tokens. Move it to a server-only env var and rotate.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return issues;
}

/* ───────────── 2. eval / Function constructor ───────────── */

function checkEvalAndFunctionConstructor(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (/(node_modules|\.next|dist)\//.test(path)) continue;
    sf.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const callee = node.getExpression().getText();
        if (callee === "eval" || callee === "globalThis.eval") {
          issues.push({
            checkId: "security/eval-call",
            dimension: "security",
            severity: "critical",
            title: "eval() executes attacker-controllable strings",
            description:
              "eval() compiles whatever string you give it. If any of the input ever comes from user data, the entire process is hijackable. Replace with JSON.parse, a switch statement, or a proper interpreter.",
            filePath: path,
            lineNumber: lineOf(sf, node.getStart()),
            codeSnippet: snip(node.getText()),
          });
        }
      }
      if (Node.isNewExpression(node)) {
        const callee = node.getExpression().getText();
        if (callee === "Function") {
          issues.push({
            checkId: "security/function-constructor",
            dimension: "security",
            severity: "high",
            title: "new Function(...) executes dynamic code",
            description:
              "new Function() is eval with extra steps. Same risk: any tainted input gives an attacker remote code execution.",
            filePath: path,
            lineNumber: lineOf(sf, node.getStart()),
            codeSnippet: snip(node.getText()),
          });
        }
      }
    });
  }
  return issues;
}

/* ───────────── 3. Math.random near token/secret ───────────── */

function checkInsecureRandom(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    if (!/Math\.random/.test(text)) continue;
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getText() !== "Math.random") return;
      // Climb to the enclosing statement / variable declaration for context.
      const stmt = node.getFirstAncestorByKind(SyntaxKind.VariableStatement);
      const enclosing = stmt
        ? stmt.getText()
        : node.getParent()?.getText() ?? "";
      if (!/token|secret|password|otp|session|id\b|uuid|nonce/i.test(enclosing))
        return;
      issues.push({
        checkId: "security/insecure-random-for-token",
        dimension: "security",
        severity: "high",
        title: "Math.random() used in a token / secret / id context",
        description:
          "Math.random() is not cryptographically secure — outputs are predictable from a few samples. Use crypto.randomBytes(n).toString('hex') or globalThis.crypto.getRandomValues(...).",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(enclosing),
      });
    });
  }
  return issues;
}

/* ───────────── 4. md5/sha1 for password hashing ───────────── */

function checkWeakPasswordHash(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    const re = /createHash\s*\(\s*['"`](md5|sha1)['"`]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // Look for password-related identifier within ±150 chars.
      const ctxStr = text.slice(Math.max(0, m.index - 150), m.index + 150);
      if (!/password|pwd|passhash/i.test(ctxStr)) continue;
      issues.push({
        checkId: "security/weak-password-hash",
        dimension: "security",
        severity: "critical",
        title: `Password hashed with ${m[1].toUpperCase()}`,
        description: `MD5 and SHA-1 are broken for password storage — GPU farms can reverse them in seconds. Use bcrypt, scrypt, argon2id, or Node's crypto.scrypt with a per-user salt.`,
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, m.index),
        codeSnippet: snip(ctxStr),
      });
    }
  }
  return issues;
}

/* ───────────── 5. CORS wildcard with credentials ───────────── */

function checkCorsWildcardWithCredentials(files: FetchedFile[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const f of files) {
    const t = f.content;
    if (!/Access-Control-Allow-Origin/i.test(t)) continue;
    const wildcard = /Access-Control-Allow-Origin['":\s,]+\*/.test(t);
    const credentials = /Access-Control-Allow-Credentials['":\s,]+true/i.test(
      t,
    );
    if (wildcard && credentials) {
      issues.push({
        checkId: "security/cors-wildcard-with-credentials",
        dimension: "security",
        severity: "critical",
        title: "CORS allows any origin AND credentials",
        description:
          "Browsers will refuse to send cookies when Access-Control-Allow-Origin is *, but many servers ignore this and the misconfig stays unnoticed until a credentialed XHR fails. Worse — if you echo the Origin header back, this becomes a full account-takeover vector. Specify exact allowed origins.",
        filePath: rel(f.path),
        lineNumber: 1,
      });
    }
  }
  return issues;
}

/* ───────────── 6. Auth routes without rate limiting ───────────── */

function checkAuthRouteRateLimit(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (
      !/^app\/api\/(auth|login|signin|signup|password|otp|2fa|verify)\b/.test(
        path,
      ) ||
      !/route\.tsx?$/.test(path)
    )
      continue;
    const text = sf.getFullText();
    if (/rateLimit|rate-limit|limiter|throttle|upstash\/ratelimit/i.test(text))
      continue;
    issues.push({
      checkId: "security/auth-no-rate-limit",
      dimension: "security",
      severity: "high",
      title: `Auth route ${path} has no rate limiting`,
      description:
        "Brute-force / credential-stuffing risk. Add a rate limiter — Upstash Ratelimit, lru-cache, or the lib/rate-limit helper EDITH ships. Aim for ≤5 attempts/min per IP + per username.",
      filePath: path,
      lineNumber: 1,
    });
  }
  return issues;
}

/* ───────────── 7. SQL string concatenation ───────────── */

function checkSqlStringConcat(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      const calleeName = Node.isPropertyAccessExpression(expr)
        ? expr.getName()
        : expr.getText();
      if (!/^(query|raw|unsafe|exec|all|get)$/.test(calleeName)) return;
      const arg = node.getArguments()[0];
      if (!arg || !Node.isBinaryExpression(arg)) return;
      if (arg.getOperatorToken().getKind() !== SyntaxKind.PlusToken) return;
      const text = arg.getText();
      if (!/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(text)) return;
      issues.push({
        checkId: "data_safety/sql-string-concat",
        dimension: "data_safety",
        severity: "critical",
        title: "Raw SQL built with string concatenation",
        description:
          "SQL injection via `'SELECT ... ' + userInput`. Use parameterised queries: db.query(text, [values]) or a query builder. Never concatenate.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText(), 240),
      });
    });
  }
  return issues;
}

/* ───────────── 8. Path traversal via fs ───────────── */

function checkPathTraversal(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression().getText();
      if (!/^fs\.(readFile|readFileSync|writeFile|writeFileSync|unlink|createReadStream|createWriteStream)/.test(callee))
        return;
      const arg = node.getArguments()[0];
      if (!arg) return;
      const argText = arg.getText();
      // Look for req/searchParams/params/body in the first argument.
      if (!/\b(req|request|searchParams|params|query|body)\b/.test(argText))
        return;
      // Skip if path.resolve / path.join with an allowlist is visible.
      if (/path\.(resolve|normalize|isAbsolute)/.test(argText)) return;
      issues.push({
        checkId: "security/path-traversal",
        dimension: "security",
        severity: "high",
        title: `${callee} called with user-derived path`,
        description:
          "A filesystem call uses a path that originates from the request. Without strict allowlisting + path.normalize() check, attackers can read arbitrary files via '../' segments.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return issues;
}

/* ───────────── 9. Open redirect ───────────── */

function checkOpenRedirect(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression().getText();
      if (
        !/\.(redirect|Redirect)$/.test(callee) &&
        callee !== "Response.redirect"
      )
        return;
      const arg = node.getArguments()[0];
      if (!arg) return;
      const t = arg.getText();
      if (!/\b(req|request|searchParams|params|query|body)\b/.test(t)) return;
      issues.push({
        checkId: "security/open-redirect",
        dimension: "security",
        severity: "high",
        title: "Redirect target taken from the request",
        description:
          "A redirect destination derives from the request without an allowlist. Attackers craft phishing links that look legit (your domain) but bounce to an evil one. Validate the host against an allowlist before redirecting.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return issues;
}

/* ───────────── 10. req.json() without validation ───────────── */

function checkNoInputValidation(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!/^app\/api\/.+\/route\.tsx?$/.test(path)) continue;
    const text = sf.getFullText();
    if (!/req\.json\(\)/.test(text)) continue;
    const hasValidator =
      /from\s+['"](zod|valibot|yup|superstruct|@sinclair\/typebox|arktype|effect\/Schema)['"]/.test(
        text,
      ) || /\.(parse|safeParse|assert|validate)\s*\(/.test(text);
    if (hasValidator) continue;
    issues.push({
      checkId: "data_safety/no-input-validation",
      dimension: "data_safety",
      severity: "high",
      title: `${path} reads req.json() without schema validation`,
      description:
        "Trusting the request body shape lets attackers send extra fields, wrong types, or huge payloads. Validate every body with zod/valibot before using it. Catches type confusion, mass-assignment, and DoS-by-size at the door.",
      filePath: path,
      lineNumber: 1,
    });
  }
  return issues;
}

/* ───────────── 11. PII in URL path/query ───────────── */

function checkPiiInUrl(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!/^app\/api\/.+\/route\.tsx?$/.test(path)) continue;
    if (
      /\[(email|phone|ssn|aadhaar|pan|dob)\]/i.test(path) ||
      /\[\.\.\.(email|phone)\]/i.test(path)
    ) {
      const match =
        path.match(/\[(email|phone|ssn|aadhaar|pan|dob)\]/i)?.[1] ?? "PII";
      issues.push({
        checkId: "data_safety/pii-in-url-path",
        dimension: "data_safety",
        severity: "medium",
        title: `Route path uses [${match}] as a segment`,
        description:
          "PII in URL paths gets written to access logs, Vercel logs, Sentry breadcrumbs, browser history, and Referer headers sent to third parties. Use opaque ids and look up the PII server-side.",
        filePath: path,
        lineNumber: 1,
      });
    }
  }
  return issues;
}

/* ───────────── 12. Error stack in HTTP response ───────────── */

function checkErrorStackInResponse(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!/^app\/api\/.+\/route\.tsx?$/.test(path)) continue;
    const text = sf.getFullText();
    if (
      /\b(NextResponse|Response)\.json\([^)]*\b(error|err|e)\.(stack|message)\b/.test(
        text,
      ) ||
      /JSON\.stringify\([^)]*\b(error|err|e)\.(stack|message)\b/.test(text)
    ) {
      issues.push({
        checkId: "data_safety/error-detail-in-response",
        dimension: "data_safety",
        severity: "medium",
        title: `${path} echoes error.stack/message in the HTTP response`,
        description:
          "Error stack traces in API responses leak file paths, line numbers, library versions, and sometimes secrets. Log them server-side, return a safe `error: 'internal'` to the client.",
        filePath: path,
        lineNumber: 1,
      });
    }
  }
  return issues;
}

/* ───────────── 13. Sync fs in route handler ───────────── */

function checkSyncFsInRoute(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!/^app\/api\/.+\/route\.tsx?$/.test(path)) continue;
    const text = sf.getFullText();
    const m = text.match(
      /\bfs\.(readFileSync|writeFileSync|appendFileSync|unlinkSync|mkdirSync|statSync|existsSync)\b/,
    );
    if (!m) continue;
    issues.push({
      checkId: "reliability/sync-fs-in-route",
      dimension: "reliability",
      severity: "medium",
      title: `${path} uses ${m[1]} inside a request handler`,
      description:
        "Sync filesystem calls block the Node event loop and tank concurrent throughput. In serverless they also hold the worker. Use the promise versions (fs/promises) instead.",
      filePath: path,
      lineNumber: 1,
    });
  }
  return issues;
}

/* ───────────── 14. No error.tsx ───────────── */

function checkNoErrorBoundary(ctx: RepoProject, files: FetchedFile[]): CheckIssue[] {
  void ctx;
  const hasApp = files.some((f) => /^app\/(layout|page)\.tsx?$/.test(f.path));
  if (!hasApp) return [];
  const hasError = files.some((f) => f.path === "app/error.tsx" || f.path === "app/error.js");
  if (hasError) return [];
  return [
    {
      checkId: "reliability/no-app-error-boundary",
      dimension: "reliability",
      severity: "medium",
      title: "No app/error.tsx — uncaught errors show the default blank page",
      description:
        "Next.js requires an error.tsx at any segment that should catch render errors. Without one, an unhandled exception shows a generic page that erodes trust. Add app/error.tsx with a friendly fallback + reset button.",
      filePath: "app/error.tsx",
      lineNumber: 1,
    },
  ];
}

/* ───────────── 15. DB query inside a loop ───────────── */

function checkDbQueryInLoop(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((loop) => {
      const isLoop =
        Node.isForStatement(loop) ||
        Node.isForOfStatement(loop) ||
        Node.isForInStatement(loop) ||
        Node.isWhileStatement(loop) ||
        Node.isDoStatement(loop);
      if (!isLoop) return;
      loop.forEachDescendant((inner) => {
        if (!Node.isAwaitExpression(inner)) return;
        const exprText = inner.getExpression().getText();
        if (!/\b(db|prisma|supabase|drizzle|knex|pool|client)\b/i.test(exprText))
          return;
        if (!/\.(query|select|from|find|update|insert|delete|exec|run|all|get)\b/.test(exprText))
          return;
        issues.push({
          checkId: "performance/db-query-in-loop",
          dimension: "performance",
          severity: "high",
          title: "DB query awaited inside a loop (N+1)",
          description:
            "Each iteration round-trips to the DB. Batch the values and run one query — typical speedup is 50-200×. Drizzle: use .with({ relation: true }). Prisma: include or where: { id: { in: ids } }.",
          filePath: rel(sf.getFilePath()),
          lineNumber: lineOf(sf, inner.getStart()),
          codeSnippet: snip(inner.getText()),
        });
      });
    });
  }
  return issues;
}

/* ───────────── 16. findMany without limit ───────────── */

function checkUnpaginatedFind(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression().getText();
      if (!/\.findMany$|\.findAll$|\.find$|\.list$/.test(callee)) return;
      const arg = node.getArguments()[0];
      const t = arg?.getText() ?? "";
      if (/\b(take|limit|first|maxResults)\s*:/.test(t)) return;
      issues.push({
        checkId: "performance/unpaginated-find",
        dimension: "performance",
        severity: "medium",
        title: "Database query has no limit / pagination",
        description:
          "Today the table is small; one day it isn't. Always pass a take/limit. The first request that pulls 50K rows takes the box down and tail-latency-poisons every other route on it.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText(), 200),
      });
    });
  }
  return issues;
}

/* ───────────── 17. Stripe amount from client ───────────── */

function checkStripeAmountFromClient(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    // Look for stripe.checkout.sessions.create / stripe.charges.create / stripe.paymentIntents.create
    if (
      !/stripe\.(charges|paymentIntents|checkout\.sessions|invoices|invoiceItems)\.create/.test(
        text,
      ) &&
      !/razorpay\.orders\.create/.test(text)
    )
      continue;
    // Search the call's arguments object for "amount: req.body.X" or similar.
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression().getText();
      if (
        !/stripe\.(charges|paymentIntents|checkout\.sessions|invoices|invoiceItems)\.create$|razorpay\.orders\.create$/.test(
          callee,
        )
      )
        return;
      const argText = node.getArguments()[0]?.getText() ?? "";
      if (!/amount\s*:/.test(argText)) return;
      // Risky if the amount value reads from req / body / params / searchParams / etc.
      if (
        /amount\s*:\s*(?:Number\()?(?:req|body|searchParams|params|query|formData|input|payload)\b/.test(
          argText,
        )
      ) {
        issues.push({
          checkId: "business_logic/payment-amount-from-client",
          dimension: "business_logic",
          severity: "critical",
          title: "Payment amount taken directly from the client",
          description:
            "Whatever the browser POSTs becomes the charge amount. Attackers send {amount: 1} and buy whatever they want. Recompute the total server-side from product ids/quantities before passing to the payment provider.",
          filePath: rel(sf.getFilePath()),
          lineNumber: lineOf(sf, node.getStart()),
          codeSnippet: snip(argText, 300),
        });
      }
    });
  }
  return issues;
}

/* ───────────── 18. Stripe charge without idempotency key ───────────── */

function checkStripeIdempotency(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression().getText();
      if (
        !/stripe\.(charges|paymentIntents|checkout\.sessions|refunds)\.create$/.test(
          callee,
        )
      )
        return;
      const args = node.getArguments();
      if (args.length < 2) {
        issues.push({
          checkId: "business_logic/stripe-no-idempotency",
          dimension: "business_logic",
          severity: "high",
          title: `${callee} called without idempotencyKey`,
          description:
            "Stripe's SDK takes a second-arg options object: `{ idempotencyKey: '...' }`. Without it, a retry (Vercel timeout, queue redelivery) double-charges the customer. Use the order id or a generated UUID per attempt.",
          filePath: rel(sf.getFilePath()),
          lineNumber: lineOf(sf, node.getStart()),
          codeSnippet: snip(node.getText()),
        });
        return;
      }
      const optsText = args[1].getText();
      if (!/idempotencyKey/i.test(optsText)) {
        issues.push({
          checkId: "business_logic/stripe-no-idempotency",
          dimension: "business_logic",
          severity: "high",
          title: `${callee} options object missing idempotencyKey`,
          description:
            "Pass `{ idempotencyKey: '<unique per attempt>' }` as the second arg so retries don't double-charge.",
          filePath: rel(sf.getFilePath()),
          lineNumber: lineOf(sf, node.getStart()),
          codeSnippet: snip(node.getText()),
        });
      }
    });
  }
  return issues;
}

/* ───────────── 19. No error-tracking dependency ───────────── */

function checkNoErrorTracker(files: FetchedFile[]): CheckIssue[] {
  const pkg = files.find((f) => f.path === "package.json");
  if (!pkg) return [];
  let json: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    json = JSON.parse(pkg.content);
  } catch {
    return [];
  }
  const deps = {
    ...(json.dependencies ?? {}),
    ...(json.devDependencies ?? {}),
  };
  const trackers = [
    "@sentry/",
    "@bugsnag/",
    "datadog-rum",
    "logrocket",
    "@highlight-run/",
    "rollbar",
    "@honeybadger-io/",
    "@vercel/analytics",
  ];
  const hasTracker = Object.keys(deps).some((d) =>
    trackers.some((t) => d.startsWith(t)),
  );
  if (hasTracker) return [];
  return [
    {
      checkId: "deploy_readiness/no-error-tracking",
      dimension: "deploy_readiness",
      severity: "medium",
      title: "No error-tracking SDK installed",
      description:
        "Your prod errors are landing nowhere. Without Sentry / Bugsnag / Datadog / etc., you'll only learn about issues when users complain. Install one and wire it in lib/log.ts or instrumentation.ts.",
      filePath: "package.json",
      lineNumber: 1,
    },
  ];
}

/* ───────────── 20. console.error swallowed without re-throw ───────────── */

function checkSwallowedCatchVariants(ctx: RepoProject): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCatchClause(node)) return;
      const body = node.getBlock().getStatements();
      // Catch with only a console.* call is functionally the same as silent.
      if (body.length !== 1) return;
      const stmt = body[0].getText();
      if (!/console\.(log|warn|error|debug)/.test(stmt)) return;
      issues.push({
        checkId: "reliability/catch-only-logs",
        dimension: "reliability",
        severity: "medium",
        title: "Catch block only console.logs — error is swallowed",
        description:
          "The function returns normally even though an exception occurred. Callers can't tell, the user sees a happy path that didn't run. Log AND either rethrow or return a typed error.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText(), 200),
      });
    });
  }
  return issues;
}

/* ============================================================ */

export function runV2Checks(
  project: RepoProject,
  files: FetchedFile[],
): CheckIssue[] {
  const out: CheckIssue[] = [];
  const runners: Array<() => CheckIssue[]> = [
    () => checkHardcodedJwtSecret(project),
    () => checkEvalAndFunctionConstructor(project),
    () => checkInsecureRandom(project),
    () => checkWeakPasswordHash(project),
    () => checkCorsWildcardWithCredentials(files),
    () => checkAuthRouteRateLimit(project),
    () => checkSqlStringConcat(project),
    () => checkPathTraversal(project),
    () => checkOpenRedirect(project),
    () => checkNoInputValidation(project),
    () => checkPiiInUrl(project),
    () => checkErrorStackInResponse(project),
    () => checkSyncFsInRoute(project),
    () => checkNoErrorBoundary(project, files),
    () => checkDbQueryInLoop(project),
    () => checkUnpaginatedFind(project),
    () => checkStripeAmountFromClient(project),
    () => checkStripeIdempotency(project),
    () => checkNoErrorTracker(files),
    () => checkSwallowedCatchVariants(project),
  ];
  for (const r of runners) {
    try {
      out.push(...r());
    } catch (err) {
      console.warn("[checks-v2] check crashed:", err);
    }
  }
  return out;
}
