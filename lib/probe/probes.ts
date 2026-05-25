/**
 * The runtime-probe registry.
 *
 * Each probe is a self-contained check that fires real HTTP against the
 * user's deployed app. When a probe fails, the finding includes the exact
 * request that proved the issue — the "exploit receipt."
 */
import "server-only";
import type {
  Probe,
  ProbeAttempt,
  ProbeContext,
  ProbeResponse,
  DiscoveredEndpoint,
} from "./types";

const renderCurl = (r: ProbeResponse): string => {
  const headerArgs = Object.entries(r.headers)
    .filter(([k]) => /^(content-type|x-)/i.test(k))
    .slice(0, 4)
    .map(([k, v]) => `-H '${k}: ${v}'`)
    .join(" ");
  const bodyArg = r.requestBody ? `--data '${r.requestBody.slice(0, 200)}'` : "";
  return `curl -X ${r.method} ${headerArgs} ${bodyArg} '${r.url}'`.replace(
    / +/g,
    " ",
  );
};

const skipped = (probeId: string, reason: string): ProbeAttempt => ({
  probeId,
  status: "skipped",
  requests: [],
  reason,
});

/* ============================================================ */
/* 1. Auth bypass on mutating routes                             */
/* ============================================================ */

const authBypass: Probe = {
  id: "probe/auth-bypass",
  title: "Mutating routes reject unauthenticated requests",
  dimension: "security",
  severity: "critical",
  description:
    "Every POST/PUT/PATCH/DELETE that isn't a webhook should reject anonymous callers with 401 or 403. EDITH fires an empty request from outside and looks for 200/204 — that means the endpoint accepted an anonymous mutation.",
  exploitNarrative: () => "",
  async run(ctx) {
    const target = pickMutating(ctx.endpoints);
    if (!target) {
      return skipped(this.id, "no non-webhook mutating endpoints discovered");
    }
    const url = ctx.baseUrl.replace(/\/$/, "") + target.path;
    const attempt = await ctx.fetcher(url, {
      method: target.method,
      timeoutMs: ctx.timeoutMs,
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const wasAllowed = attempt.status >= 200 && attempt.status < 300;
    if (!wasAllowed) {
      return { probeId: this.id, status: "pass", requests: [attempt] };
    }
    return {
      probeId: this.id,
      status: "fail",
      requests: [attempt],
      finding: {
        title: `${target.method} ${target.path} accepts unauthenticated mutations`,
        severity: "critical",
        dimension: "security",
        description: `EDITH POSTed to ${target.path} without any session cookie or Authorization header. The route returned ${attempt.status} ${attempt.statusText} — the mutation was accepted. Anyone with the URL can call this route. Add an auth check at the top of the handler.`,
        exploitProof: `I just called ${target.method} ${attempt.url} from outside your auth perimeter and got a ${attempt.status} response in ${attempt.durationMs}ms. That isn't a static guess — it's the actual response.`,
        reproducer: renderCurl(attempt),
      },
    };
  },
};

/* ============================================================ */
/* 2. Stripe webhook signature bypass                            */
/* ============================================================ */

const stripeWebhookBypass: Probe = {
  id: "probe/stripe-webhook-bypass",
  title: "Stripe webhook rejects forged signatures",
  dimension: "security",
  severity: "critical",
  description:
    "Fires a POST to app/api/webhooks/stripe with a fake Stripe-Signature header. A correctly-coded handler returns 400/401. A 200 means the route is trusting the body without verification.",
  exploitNarrative: () => "",
  async run(ctx) {
    const ep = ctx.endpoints.find(
      (e) =>
        e.method === "POST" && /webhooks\/stripe\b/.test(e.path) && e.isWebhook,
    );
    if (!ep) return skipped(this.id, "no Stripe webhook route found");
    const url = ctx.baseUrl.replace(/\/$/, "") + ep.path;
    const fakeBody = JSON.stringify({
      id: "evt_edith_probe",
      type: "checkout.session.completed",
      data: { object: { id: "cs_edith_probe", metadata: {} } },
    });
    const attempt = await ctx.fetcher(url, {
      method: "POST",
      timeoutMs: ctx.timeoutMs,
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": "t=0,v1=edith_probe_forged",
      },
      body: fakeBody,
    });
    const bypassed = attempt.status >= 200 && attempt.status < 300;
    if (!bypassed) {
      return { probeId: this.id, status: "pass", requests: [attempt] };
    }
    return {
      probeId: this.id,
      status: "fail",
      requests: [attempt],
      finding: {
        title: "Stripe webhook accepts forged signatures",
        severity: "critical",
        dimension: "security",
        description: `EDITH posted a forged checkout.session.completed event to ${ep.path} with a junk Stripe-Signature header. The route returned ${attempt.status} ${attempt.statusText}. An attacker could mark any order as paid by sending the right JSON to this URL.`,
        exploitProof: `I just got a ${attempt.status} from ${attempt.url} with a fake signature header in ${attempt.durationMs}ms. A correctly-verified Stripe webhook returns 400.`,
        reproducer: renderCurl(attempt),
      },
    };
  },
};

/* ============================================================ */
/* 3. Webhook idempotency (duplicate event handling)             */
/* ============================================================ */

const webhookIdempotency: Probe = {
  id: "probe/webhook-idempotency",
  title: "Payment webhooks handle duplicate events",
  dimension: "reliability",
  severity: "high",
  description:
    "Fires the same payment webhook payload twice with identical event id. A correctly idempotent handler returns 200 both times but only commits one side-effect. The probe can't directly observe the side-effect, so it asserts on consistent response and absence of 5xx.",
  exploitNarrative: () => "",
  async run(ctx) {
    const ep = ctx.endpoints.find(
      (e) =>
        e.method === "POST" && e.isWebhook && e.isPayment,
    );
    if (!ep) return skipped(this.id, "no payment webhook route found");
    const url = ctx.baseUrl.replace(/\/$/, "") + ep.path;
    const body = JSON.stringify({
      id: "evt_edith_idem_test",
      type: "payment.captured",
      data: { id: "edith_idem_test" },
    });
    const headers = {
      "Content-Type": "application/json",
      "X-Edith-Probe": "idempotency",
    };
    const first = await ctx.fetcher(url, {
      method: "POST",
      headers,
      body,
      timeoutMs: ctx.timeoutMs,
    });
    const second = await ctx.fetcher(url, {
      method: "POST",
      headers,
      body,
      timeoutMs: ctx.timeoutMs,
    });
    // We pass only if BOTH respond identically and neither 5xx'd.
    const failed5xx = first.status >= 500 || second.status >= 500;
    const inconsistent = first.status !== second.status;
    if (!failed5xx && !inconsistent) {
      return { probeId: this.id, status: "pass", requests: [first, second] };
    }
    return {
      probeId: this.id,
      status: "fail",
      requests: [first, second],
      finding: {
        title: failed5xx
          ? "Payment webhook 5xx'd on duplicate event"
          : "Payment webhook responses diverged on duplicate event",
        severity: "high",
        dimension: "reliability",
        description: failed5xx
          ? `EDITH sent the same event twice. The first attempt returned ${first.status}, the second returned ${second.status}. A 5xx on duplicate delivery is a sign the handler doesn't dedupe — the provider's retry will cause double-processing once you fix the 5xx.`
          : `EDITH sent the same event twice. First responded ${first.status}, second responded ${second.status}. A correctly idempotent handler returns the same status both times (usually 200 + "already processed" the second time).`,
        exploitProof: `Two requests with the same idempotency body, sent ${(second.durationMs + first.durationMs)}ms apart. Different responses (${first.status} → ${second.status}).`,
        reproducer: renderCurl(first) + "\n# then re-run identically",
      },
    };
  },
};

/* ============================================================ */
/* 4. CSRF on cookie-authed mutations                            */
/* ============================================================ */

const csrfProbe: Probe = {
  id: "probe/csrf-cross-origin",
  title: "Mutating routes reject cross-origin requests",
  dimension: "security",
  severity: "high",
  description:
    "Sends a mutating request with a forged Origin header from a different domain. A correctly-defended app rejects it (400/403). A 2xx means the route is vulnerable to CSRF if the user is logged in.",
  exploitNarrative: () => "",
  async run(ctx) {
    const target = pickMutating(ctx.endpoints);
    if (!target) return skipped(this.id, "no mutating endpoint to test");
    const url = ctx.baseUrl.replace(/\/$/, "") + target.path;
    const attempt = await ctx.fetcher(url, {
      method: target.method,
      timeoutMs: ctx.timeoutMs,
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
        Referer: "https://evil.example/attack",
      },
      body: "{}",
    });
    const allowed = attempt.status >= 200 && attempt.status < 300;
    if (!allowed) {
      return { probeId: this.id, status: "pass", requests: [attempt] };
    }
    return {
      probeId: this.id,
      status: "fail",
      requests: [attempt],
      finding: {
        title: `${target.path} accepts cross-origin mutations`,
        severity: "high",
        dimension: "security",
        description: `EDITH POSTed to ${target.path} with Origin: https://evil.example and got ${attempt.status}. If users are session-cookie-authed, an attacker can host a page that triggers this route on their behalf (classic CSRF). Add an Origin/Referer check or use SameSite=strict cookies + CSRF tokens.`,
        exploitProof: `Cross-origin POST returned ${attempt.status} in ${attempt.durationMs}ms — no Origin check fired.`,
        reproducer: renderCurl(attempt),
      },
    };
  },
};

/* ============================================================ */
/* 5. Security headers on top-level routes                       */
/* ============================================================ */

const securityHeaders: Probe = {
  id: "probe/security-headers",
  title: "Production responses set baseline security headers",
  dimension: "security",
  severity: "medium",
  description:
    "GETs the base URL and checks for X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, X-Frame-Options. Missing headers don't break anything but leave doors open.",
  exploitNarrative: () => "",
  async run(ctx) {
    const attempt = await ctx.fetcher(ctx.baseUrl, {
      method: "GET",
      timeoutMs: ctx.timeoutMs,
    });
    if (attempt.status === 0) {
      return skipped(this.id, "base URL unreachable");
    }
    const missing: string[] = [];
    if (!attempt.headers["x-content-type-options"])
      missing.push("X-Content-Type-Options");
    if (!attempt.headers["strict-transport-security"])
      missing.push("Strict-Transport-Security");
    if (!attempt.headers["referrer-policy"]) missing.push("Referrer-Policy");
    if (
      !attempt.headers["x-frame-options"] &&
      !/frame-ancestors/.test(attempt.headers["content-security-policy"] ?? "")
    )
      missing.push("X-Frame-Options or CSP frame-ancestors");

    if (missing.length === 0) {
      return { probeId: this.id, status: "pass", requests: [attempt] };
    }
    return {
      probeId: this.id,
      status: "fail",
      requests: [attempt],
      finding: {
        title: `Missing security headers: ${missing.join(", ")}`,
        severity: missing.length >= 3 ? "high" : "medium",
        dimension: "security",
        description: `EDITH fetched ${ctx.baseUrl} and the response did not include: ${missing.join(", ")}. These don't break anything when missing, but they're the cheapest defense layer your app can have. Add them in next.config.ts headers() or in proxy.ts.`,
        exploitProof: `Response from GET ${ctx.baseUrl} returned ${attempt.status} but Content-Security headers were absent.`,
        reproducer: `curl -I '${ctx.baseUrl}'`,
      },
    };
  },
};

/* ============================================================ */
/* 6. Health-check endpoint exists and reports DB                */
/* ============================================================ */

const healthCheck: Probe = {
  id: "probe/health-check",
  title: "/api/health is reachable and returns 2xx",
  dimension: "deploy_readiness",
  severity: "medium",
  description:
    "GETs /api/health. A healthy app responds 200 within a few hundred ms. Missing route, 404, or 5xx means uptime monitors can't distinguish a stuck deploy from a slow one.",
  exploitNarrative: () => "",
  async run(ctx) {
    const url = ctx.baseUrl.replace(/\/$/, "") + "/api/health";
    const attempt = await ctx.fetcher(url, {
      method: "GET",
      timeoutMs: ctx.timeoutMs,
    });
    if (attempt.status >= 200 && attempt.status < 300) {
      return { probeId: this.id, status: "pass", requests: [attempt] };
    }
    return {
      probeId: this.id,
      status: "fail",
      requests: [attempt],
      finding: {
        title:
          attempt.status === 404
            ? "/api/health endpoint not found"
            : `/api/health returned ${attempt.status}`,
        severity: "medium",
        dimension: "deploy_readiness",
        description: `EDITH GET'd ${url} and received ${attempt.status} ${attempt.statusText}. Add an app/api/health/route.ts that pings the DB and returns 200/503. Uptime monitors and orchestrators depend on it.`,
        exploitProof: `GET ${url} → ${attempt.status} in ${attempt.durationMs}ms.`,
        reproducer: `curl -I '${url}'`,
      },
    };
  },
};

/* ============================================================ */
/* 7. XSS reflection in 404 page                                 */
/* ============================================================ */

const xssReflection: Probe = {
  id: "probe/xss-reflection",
  title: "404 / error pages don't reflect attacker-controlled paths unsanitised",
  dimension: "security",
  severity: "high",
  description:
    "Requests a path with a script-like payload. If the rendered response contains the literal payload (unescaped), the app may be vulnerable to reflected XSS in error pages.",
  exploitNarrative: () => "",
  async run(ctx) {
    const payload = '<svg/onload="window.__edith_xss__=1">';
    const url = `${ctx.baseUrl.replace(/\/$/, "")}/edith-probe-${encodeURIComponent(payload)}`;
    const attempt = await ctx.fetcher(url, {
      method: "GET",
      timeoutMs: ctx.timeoutMs,
    });
    if (attempt.bodyText.includes(payload)) {
      return {
        probeId: this.id,
        status: "fail",
        requests: [attempt],
        finding: {
          title: "Path is reflected unescaped in the response body",
          severity: "high",
          dimension: "security",
          description: `EDITH visited a URL whose path contained \`${payload}\`. The HTML response contained that exact string unescaped. A user who clicks a crafted link could execute attacker JavaScript inside your app's origin (cookie theft, session hijack).`,
          exploitProof: `Response body from ${attempt.url} contained the literal payload \`${payload}\`.`,
          reproducer: `curl '${url}'`,
        },
      };
    }
    return { probeId: this.id, status: "pass", requests: [attempt] };
  },
};

/* ============================================================ */
/* Helpers                                                       */
/* ============================================================ */

function pickMutating(eps: DiscoveredEndpoint[]): DiscoveredEndpoint | null {
  // Prefer non-payment non-webhook (payment webhooks have their own probes).
  const candidates = eps.filter(
    (e) =>
      (e.method === "POST" ||
        e.method === "PUT" ||
        e.method === "PATCH" ||
        e.method === "DELETE") &&
      !e.isWebhook,
  );
  if (candidates.length === 0) return null;
  // Prefer ones where the code looked auth'd (so a fail is a clear bug).
  const authed = candidates.find((c) => c.hasAuthInCode);
  return authed ?? candidates[0];
}

export const PROBES: Probe[] = [
  authBypass,
  stripeWebhookBypass,
  webhookIdempotency,
  csrfProbe,
  securityHeaders,
  healthCheck,
  xssReflection,
];

/* ============================================================ */
/* Runner                                                         */
/* ============================================================ */

export async function runProbes(
  ctx: ProbeContext,
): Promise<ProbeAttempt[]> {
  const attempts: ProbeAttempt[] = [];
  for (const probe of PROBES) {
    try {
      attempts.push(await probe.run(ctx));
    } catch (err) {
      attempts.push({
        probeId: probe.id,
        status: "error",
        requests: [],
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return attempts;
}
