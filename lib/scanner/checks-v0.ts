/**
 * v0 checks — regex/string-match against fetched file contents.
 *
 * Each check is self-contained: given the file list, return any issues found.
 * Real v1 checks will use ts-morph AST analysis. These are deliberate
 * "good enough for the demo loop" implementations.
 */
import type { Dimension, Severity } from "../mock-data";

export type CheckFile = { path: string; content: string };

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

type Check = {
  id: string;
  dimension: Dimension;
  defaultSeverity: Severity;
  title: string;
  run: (files: CheckFile[]) => CheckIssue[];
};

function lineOf(content: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

/* ─── Security ─────────────────────────────────────────────── */

const stripeWebhookSig: Check = {
  id: "security/stripe-webhook-signature",
  dimension: "security",
  defaultSeverity: "critical",
  title: "Stripe webhook signature not verified",
  run(files) {
    const f = files.find((f) =>
      /app\/api\/webhooks\/stripe\/route\.ts$/.test(f.path),
    );
    if (!f) return [];
    if (/constructEvent\s*\(/.test(f.content)) return [];
    return [
      {
        checkId: stripeWebhookSig.id,
        dimension: stripeWebhookSig.dimension,
        severity: stripeWebhookSig.defaultSeverity,
        title: stripeWebhookSig.title,
        description:
          "Webhook handler at app/api/webhooks/stripe/route.ts does not call stripe.webhooks.constructEvent. The request body is trusted without verifying the Stripe-Signature header — attackers can POST forged events to mark orders as paid.",
        filePath: f.path,
        lineNumber: 1,
      },
    ];
  },
};

const razorpayWebhookSig: Check = {
  id: "security/razorpay-webhook-signature",
  dimension: "security",
  defaultSeverity: "critical",
  title: "Razorpay webhook signature not verified",
  run(files) {
    const f = files.find((f) =>
      /app\/api\/webhooks\/razorpay\/route\.ts$/.test(f.path),
    );
    if (!f) return [];
    if (/createHmac\s*\(\s*['"`]sha256['"`]/.test(f.content)) return [];
    return [
      {
        checkId: razorpayWebhookSig.id,
        dimension: razorpayWebhookSig.dimension,
        severity: razorpayWebhookSig.defaultSeverity,
        title: razorpayWebhookSig.title,
        description:
          "Razorpay webhook handler does not appear to verify the HMAC-SHA256 signature header. Use crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET) and compare to the x-razorpay-signature header.",
        filePath: f.path,
        lineNumber: 1,
      },
    ];
  },
};

const secretInClient: Check = {
  id: "security/secret-in-client",
  dimension: "security",
  defaultSeverity: "critical",
  title: "Server-side secret referenced from client code",
  run(files) {
    const secretNames = [
      "STRIPE_SECRET_KEY",
      "RAZORPAY_KEY_SECRET",
      "PAYU_MERCHANT_SALT",
      "SUPABASE_SERVICE_ROLE_KEY",
      "ANTHROPIC_API_KEY",
    ];
    const out: CheckIssue[] = [];
    for (const f of files) {
      if (!/package\.json$/.test(f.path)) continue; // v0 stub: only flag if package.json shows misuse
      for (const s of secretNames) {
        const re = new RegExp(`process\\.env\\.${s}\\b`);
        if (re.test(f.content)) {
          const idx = f.content.search(re);
          out.push({
            checkId: secretInClient.id,
            dimension: "security",
            severity: "critical",
            title: `${s} appears in a client-reachable file`,
            description: `${s} is a server-side secret. Move it behind a Server Action or API route — never reference it in code that could end up in the client bundle.`,
            filePath: f.path,
            lineNumber: lineOf(f.content, idx),
            codeSnippet: f.content
              .split("\n")
              [lineOf(f.content, idx) - 1]?.trim()
              .slice(0, 200),
          });
        }
      }
    }
    return out;
  },
};

/* ─── Deploy readiness ────────────────────────────────────── */

const missingEnvExample: Check = {
  id: "deploy_readiness/no-env-example",
  dimension: "deploy_readiness",
  defaultSeverity: "low",
  title: "No .env.example committed",
  run(files) {
    if (files.some((f) => f.path === ".env.example")) return [];
    return [
      {
        checkId: missingEnvExample.id,
        dimension: missingEnvExample.dimension,
        severity: missingEnvExample.defaultSeverity,
        title: missingEnvExample.title,
        description:
          "Without an .env.example, contributors and CI don't know which env vars the app needs. List every var the app reads (no values) so deployments fail fast on missing config.",
        filePath: ".env.example",
        lineNumber: 1,
      },
    ];
  },
};

const missingHealthCheck: Check = {
  id: "deploy_readiness/no-health-check",
  dimension: "deploy_readiness",
  defaultSeverity: "medium",
  title: "No /api/health endpoint",
  run(files) {
    if (files.some((f) => /app\/api\/health\/route\.ts$/.test(f.path)))
      return [];
    return [
      {
        checkId: missingHealthCheck.id,
        dimension: missingHealthCheck.dimension,
        severity: missingHealthCheck.defaultSeverity,
        title: missingHealthCheck.title,
        description:
          "Add app/api/health/route.ts that pings the DB and returns 200/503. Lets uptime monitors distinguish a stuck deploy from a slow one.",
        filePath: "app/api/health/route.ts",
        lineNumber: 1,
      },
    ];
  },
};

/* ─── Data safety ─────────────────────────────────────────── */

const missingRls: Check = {
  id: "data_safety/missing-rls",
  dimension: "data_safety",
  defaultSeverity: "critical",
  title: "Supabase tables created without explicit RLS",
  run(files) {
    const sql = files.find((f) => /supabase\/migrations\/.+\.sql$/.test(f.path));
    if (!sql) return [];
    const hasCreateTable = /create\s+table\s+public\./i.test(sql.content);
    const hasEnableRls = /enable\s+row\s+level\s+security/i.test(sql.content);
    if (!hasCreateTable) return [];
    if (hasEnableRls) return [];
    return [
      {
        checkId: missingRls.id,
        dimension: missingRls.dimension,
        severity: missingRls.defaultSeverity,
        title: missingRls.title,
        description:
          "Public Supabase tables were created but no `alter table … enable row level security` statement was found. Without RLS, the anon key can read everything.",
        filePath: sql.path,
        lineNumber: 1,
      },
    ];
  },
};

/* ─── Reliability ─────────────────────────────────────────── */

const missingWebhookIdempotency: Check = {
  id: "reliability/webhook-no-idempotency",
  dimension: "reliability",
  defaultSeverity: "high",
  title: "Webhook handlers missing idempotency",
  run(files) {
    const webhookFiles = files.filter((f) =>
      /app\/api\/webhooks\/.+\/route\.ts$/.test(f.path),
    );
    return webhookFiles
      .filter(
        (f) =>
          !/webhook_events|idempotenc|already\s+processed/i.test(f.content),
      )
      .map<CheckIssue>((f) => ({
        checkId: missingWebhookIdempotency.id,
        dimension: "reliability",
        severity: "high",
        title: missingWebhookIdempotency.title,
        description:
          "Webhook handler doesn't dedupe events. On retry (network blip on the provider's side) the same event will be processed twice — orders double-credited, refunds double-applied. Insert event.id into a webhook_events table with a unique constraint before processing.",
        filePath: f.path,
        lineNumber: 1,
      }));
  },
};

/* ─── Performance ─────────────────────────────────────────── */

const nextConfigUnsafe: Check = {
  id: "performance/next-config-eval",
  dimension: "performance",
  defaultSeverity: "low",
  title: "next.config allows eval-based devtool",
  run(files) {
    const conf = files.find((f) => /next\.config\.(t|m?j)s$/.test(f.path));
    if (!conf) return [];
    if (!/eval/i.test(conf.content)) return [];
    return [
      {
        checkId: nextConfigUnsafe.id,
        dimension: nextConfigUnsafe.dimension,
        severity: nextConfigUnsafe.defaultSeverity,
        title: nextConfigUnsafe.title,
        description:
          "Found `eval` reference in next.config — usually a webpack devtool override. Drop it for production builds (forces unsafe-eval in CSP and bloats the bundle).",
        filePath: conf.path,
        lineNumber: 1,
      },
    ];
  },
};

export const CHECK_REGISTRY: Check[] = [
  stripeWebhookSig,
  razorpayWebhookSig,
  secretInClient,
  missingEnvExample,
  missingHealthCheck,
  missingRls,
  missingWebhookIdempotency,
  nextConfigUnsafe,
];

export async function runAllChecks(args: {
  files: CheckFile[];
}): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = [];
  for (const c of CHECK_REGISTRY) {
    try {
      issues.push(...c.run(args.files));
    } catch (err) {
      console.error(`[scanner] check ${c.id} failed:`, err);
    }
  }
  return issues;
}
