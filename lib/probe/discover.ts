/**
 * Walk the fetched repo files and discover Next.js App-Router API routes
 * (`app/api/.../route.ts(x)`). For each, determine which HTTP methods are
 * exported, whether the file appears to contain auth checks, and whether
 * it's a webhook / payment route.
 *
 * Used by the runtime probe runner to know which endpoints to test.
 */
import "server-only";
import { Node, SyntaxKind } from "ts-morph";
import type { RepoProject } from "../scanner/project";
import type { DiscoveredEndpoint } from "./types";

const METHODS: DiscoveredEndpoint["method"][] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

const AUTH_PATTERNS = [
  /supabase\.auth\.(getUser|getSession)/,
  /getServerSession\b/,
  /currentUser\(\)/,
  /auth\(\)\.protect/,
  /requireAuth\b/,
  /\bclerk\b/i,
  /\bgetAuth\b/,
  /\bvalidateRequest\b/,
];

export function discoverEndpoints(project: RepoProject): DiscoveredEndpoint[] {
  const out: DiscoveredEndpoint[] = [];
  for (const sf of project.project.getSourceFiles()) {
    const path = sf.getFilePath().replace(/^\//, "");
    const m = path.match(/^app\/api\/(.+?)\/route\.tsx?$/);
    if (!m) continue;
    const apiPath = "/api/" + m[1].replace(/\/route$/, "");
    const text = sf.getFullText();
    const hasAuthInCode = AUTH_PATTERNS.some((re) => re.test(text));
    const isWebhook = /\/webhooks?\//.test(apiPath);
    const isPayment = /\b(stripe|razorpay|payu|paypal)\b/i.test(apiPath);

    // Find exported method names.
    const exported = new Set<string>();
    for (const fn of sf.getFunctions()) {
      if (fn.isExported() && fn.getName()) exported.add(fn.getName()!);
    }
    for (const stmt of sf.getVariableStatements()) {
      if (!stmt.isExported()) continue;
      for (const d of stmt.getDeclarations()) exported.add(d.getName());
    }

    for (const meth of METHODS) {
      if (exported.has(meth)) {
        out.push({
          method: meth,
          path: normalisePath(apiPath),
          filePath: path,
          hasAuthInCode,
          isWebhook,
          isPayment,
        });
      }
    }

    void SyntaxKind; // silence unused import warning
    void Node;
  }
  return out;
}

/** Convert Next.js dynamic-segment routes to a probe-able URL (use placeholders). */
function normalisePath(p: string): string {
  return p
    .replace(/\[\.\.\.([^\]]+)\]/g, "test/test")
    .replace(/\[([^\]]+)\]/g, "1");
}
