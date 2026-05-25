/**
 * Registry of all 30 EDITH checks.
 *
 * Each check has a stable `id` (used in DB + drift detection),
 * a `dimension`, a default `severity`, and a `run` function that returns
 * issues for a given parsed source tree.
 *
 * For v1 these are stubs — they declare metadata only. Real implementations
 * land in lib/scanner/checks/<dimension>/<id>.ts later.
 */

import type { Dimension, Severity } from "@/lib/mock-data";

export type ScanContext = {
  repoId: string;
  scanId: string;
  files: { path: string; content: string }[];
  // future: ts-morph Project, env-var index, package.json, etc.
};

export type CheckIssue = {
  checkId: string;
  severity: Severity;
  dimension: Dimension;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
};

export type Check = {
  id: string;
  dimension: Dimension;
  defaultSeverity: Severity;
  title: string;
  run: (ctx: ScanContext) => Promise<CheckIssue[]>;
};

const notImplemented = async (): Promise<CheckIssue[]> => [];

export const CHECKS: Check[] = [
  /* ─── Security ─────────────────────────────────────────────── */
  { id: "security/stripe-webhook-signature", dimension: "security", defaultSeverity: "critical", title: "Stripe webhook signature not verified", run: notImplemented },
  { id: "security/razorpay-key-in-client", dimension: "security", defaultSeverity: "critical", title: "Razorpay or PayU key in client bundle", run: notImplemented },
  { id: "security/missing-csrf", dimension: "security", defaultSeverity: "high", title: "Missing CSRF token on mutating route", run: notImplemented },
  { id: "security/auth-bypass-middleware", dimension: "security", defaultSeverity: "critical", title: "Auth middleware bypassable", run: notImplemented },
  { id: "security/unsanitised-redirect", dimension: "security", defaultSeverity: "high", title: "Open redirect via unsanitised user input", run: notImplemented },

  /* ─── Performance ──────────────────────────────────────────── */
  { id: "performance/n-plus-one-query", dimension: "performance", defaultSeverity: "high", title: "N+1 database query in handler", run: notImplemented },
  { id: "performance/blocking-import", dimension: "performance", defaultSeverity: "medium", title: "Blocking import above the fold", run: notImplemented },
  { id: "performance/large-bundle", dimension: "performance", defaultSeverity: "medium", title: "Client bundle exceeds 200kb gzipped", run: notImplemented },
  { id: "performance/missing-image-dims", dimension: "performance", defaultSeverity: "low", title: "Image without explicit width/height", run: notImplemented },
  { id: "performance/missing-cache-headers", dimension: "performance", defaultSeverity: "low", title: "Public route missing cache headers", run: notImplemented },

  /* ─── Reliability ──────────────────────────────────────────── */
  { id: "reliability/unhandled-promise", dimension: "reliability", defaultSeverity: "high", title: "Unhandled promise rejection in handler", run: notImplemented },
  { id: "reliability/no-retry-external-api", dimension: "reliability", defaultSeverity: "medium", title: "External API call without retry", run: notImplemented },
  { id: "reliability/missing-timeout", dimension: "reliability", defaultSeverity: "medium", title: "External fetch without timeout", run: notImplemented },
  { id: "reliability/webhook-no-idempotency", dimension: "reliability", defaultSeverity: "high", title: "Webhook handler missing idempotency", run: notImplemented },
  { id: "reliability/error-swallowed", dimension: "reliability", defaultSeverity: "high", title: "Error caught and silently discarded", run: notImplemented },

  /* ─── Data Safety ──────────────────────────────────────────── */
  { id: "data_safety/missing-rls", dimension: "data_safety", defaultSeverity: "critical", title: "Supabase table without RLS policy", run: notImplemented },
  { id: "data_safety/raw-sql-injection", dimension: "data_safety", defaultSeverity: "critical", title: "Raw SQL with user input", run: notImplemented },
  { id: "data_safety/pii-logged", dimension: "data_safety", defaultSeverity: "high", title: "PII written to logs unredacted", run: notImplemented },
  { id: "data_safety/permissive-cors", dimension: "data_safety", defaultSeverity: "high", title: "CORS allows any origin", run: notImplemented },
  { id: "data_safety/orphan-table", dimension: "data_safety", defaultSeverity: "low", title: "Table referenced in code but missing in schema", run: notImplemented },

  /* ─── Business Logic ───────────────────────────────────────── */
  { id: "business_logic/client-side-total", dimension: "business_logic", defaultSeverity: "critical", title: "Order total computed client-side", run: notImplemented },
  { id: "business_logic/coupon-negative-price", dimension: "business_logic", defaultSeverity: "critical", title: "Discount can yield negative final amount", run: notImplemented },
  { id: "business_logic/missing-auth-check", dimension: "business_logic", defaultSeverity: "critical", title: "Mutation route missing auth check", run: notImplemented },
  { id: "business_logic/race-condition-checkout", dimension: "business_logic", defaultSeverity: "high", title: "Race condition in checkout flow", run: notImplemented },
  { id: "business_logic/missing-idempotency-key", dimension: "business_logic", defaultSeverity: "high", title: "Payment route missing idempotency key", run: notImplemented },

  /* ─── Deploy Readiness ─────────────────────────────────────── */
  { id: "deploy_readiness/missing-env-var", dimension: "deploy_readiness", defaultSeverity: "high", title: "Env var referenced but undefined", run: notImplemented },
  { id: "deploy_readiness/no-health-check", dimension: "deploy_readiness", defaultSeverity: "medium", title: "No /api/health endpoint", run: notImplemented },
  { id: "deploy_readiness/build-warnings-ignored", dimension: "deploy_readiness", defaultSeverity: "medium", title: "Build warnings ignored in CI", run: notImplemented },
  { id: "deploy_readiness/migration-without-rollback", dimension: "deploy_readiness", defaultSeverity: "medium", title: "Migration without rollback plan", run: notImplemented },
  { id: "deploy_readiness/no-error-tracking", dimension: "deploy_readiness", defaultSeverity: "low", title: "No error-tracking SDK initialised", run: notImplemented },
];

export function getCheck(id: string): Check | undefined {
  return CHECKS.find((c) => c.id === id);
}

export function checksByDimension(dim: Dimension): Check[] {
  return CHECKS.filter((c) => c.dimension === dim);
}
