import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ============ Types ============ */

export type Severity = "critical" | "high" | "medium" | "low";

export type Finding = {
  checkId: string;
  severity: Severity;
  dimension: string;
  title: string;
  description: string;
  url?: string;
  origin?: string;
};

export type ScanPayload = {
  origin?: string;
  url?: string;
  title?: string;
  tools?: string[];
  scannedAt?: number;
  findings: Finding[];
};

export const SEV_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const SEV_WEIGHT: Record<Severity, number> = {
  critical: 18,
  high: 9,
  medium: 4,
  low: 1,
};

/* ============ Score helpers ============ */

export function scoreOf(findings: Finding[]): number {
  const penalty = findings.reduce((s, f) => s + (SEV_WEIGHT[f.severity] || 0), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export type Tone = "good" | "warn" | "bad";

export function toneFor(score: number): Tone {
  if (score >= 85) return "good";
  if (score >= 65) return "warn";
  return "bad";
}

export function colorFor(tone: Tone): string {
  return tone === "good"
    ? "var(--color-success)"
    : tone === "warn"
      ? "var(--color-accent)"
      : "var(--color-danger)";
}

/* ============ Chrome runtime bridge ============ */

type ChromeResponse<T> = { ok: boolean } & Partial<T>;

export function sendMessage<T>(msg: unknown): Promise<ChromeResponse<T>> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) resolve({ ok: false });
        else resolve(res ?? { ok: false });
      });
    } catch {
      resolve({ ok: false });
    }
  });
}

export async function storageGet<T = unknown>(
  key: string,
): Promise<T | undefined> {
  try {
    const d = await chrome.storage.local.get(key);
    return d[key] as T;
  } catch {
    return undefined;
  }
}

export async function storageSet(items: Record<string, unknown>): Promise<void> {
  try {
    await chrome.storage.local.set(items);
  } catch {
    /* noop */
  }
}

/* ============ History ============ */

const HISTORY_KEY = "edith_history";
const HISTORY_MAX = 10;

export type HistoryEntry = {
  url: string;
  origin: string;
  title: string;
  score: number;
  counts: Record<Severity, number>;
  at: number;
};

export async function recordHistory(payload: ScanPayload) {
  if (!payload.url) return;
  const findings = payload.findings || [];
  const entry: HistoryEntry = {
    url: payload.url,
    origin: payload.origin || "",
    title: payload.title || payload.origin || payload.url,
    score: scoreOf(findings),
    counts: {
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
    },
    at: Date.now(),
  };
  const existing = (await storageGet<HistoryEntry[]>(HISTORY_KEY)) || [];
  const next = [entry, ...existing.filter((x) => x.url !== entry.url)].slice(
    0,
    HISTORY_MAX,
  );
  await storageSet({ [HISTORY_KEY]: next });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return (await storageGet<HistoryEntry[]>(HISTORY_KEY)) || [];
}

/* ============ Fix prompts (paste-ready for the user's agent) ============ */

export const FIX_PROMPTS: Record<string, (f: Finding) => string> = {
  "ext/leaked-secret": (f) =>
    `In the codebase that builds ${f.origin}, a live secret was shipped to the client (${f.title}).

1. Find the file the secret lives in (likely a committed .env, or a Server Component that returned the value into props).
2. Move it to a server-only env var (NO NEXT_PUBLIC_ prefix).
3. Replace any client-side use with a Server Action that wraps the operation.
4. ROTATE THE KEY NOW — it's in git history forever even after you remove it. Exposed at ${f.url}.`,

  "ext/next-public-sensitive": (f) =>
    `${f.title}. Variables prefixed with NEXT_PUBLIC_ are bundled into the browser by Next.js — visible to anyone in DevTools.

1. Find every reference to the variable in the codebase.
2. Move it to a server-only env var without the NEXT_PUBLIC_ prefix.
3. Wrap reads in a Server Action or API route; have the client call that, not the variable directly.
4. If the value was public for any time, rotate it.`,

  "ext/cookie-readable-from-js": (f) =>
    `${f.title}. The cookie is missing HttpOnly — any XSS on the origin can steal the session.

1. Find where the cookie is set (Set-Cookie in your API routes, or cookies().set(...) in Next.js).
2. Add httpOnly: true to the cookie options.
3. While you're there, also set secure: true (production) and sameSite: 'lax'.
4. Verify in DevTools → Application → Cookies — the HttpOnly column should be checked.`,

  "ext/cookie-not-secure": (f) =>
    `${f.title}. On HTTPS, session cookies should have Secure: true so the browser refuses to send them over plain HTTP.

In the cookie set call, add: secure: process.env.NODE_ENV === 'production'.
Do NOT force secure on localhost — http localhost will drop the cookie if you do.`,

  "ext/cookie-samesite-weak": (f) =>
    `${f.title}. Without SameSite, an attacker's site can trigger requests that include this cookie (CSRF on cookie-authed mutating routes).

Add: sameSite: 'lax' (or 'strict' for payment routes).`,

  "ext/localstorage-secret": (f) =>
    `${f.title}. localStorage is readable by every script on this origin, including XSS-injected ones.

1. Locate where you call localStorage.setItem for this key.
2. Move the token to an HttpOnly cookie set by your API route after auth.
3. Never read the token on the client — let the server route auth via the cookie.
4. If you must keep client state, store an opaque session id (not a JWT, not the user object).`,

  "ext/target-blank-no-noopener": (f) =>
    `${f.title}. target="_blank" lets the opened page access window.opener and navigate the originating tab to a phishing URL.

Add rel="noopener noreferrer" to every external link with target="_blank".`,

  "ext/form-cross-origin": (f) =>
    `${f.title}. A form that submits across origins is either intentional (Stripe Checkout etc.) or a phishing target.

1. If intentional, document it and verify the destination origin is exactly what you expect.
2. If unintentional, change the action to a same-origin route that proxies the work server-side.
3. Ensure no credentials/tokens are in hidden fields you're shipping to a third party.`,

  "ext/mixed-content": (f) =>
    `${f.title}. Insecure resources on an HTTPS page get blocked or warn the user.

1. Search the codebase for http:// references in img/script/link/iframe attributes.
2. Replace with https:// or protocol-relative //.
3. If a third party only serves http, find an https alternative — don't downgrade the whole page.`,

  "ext/source-map-public": (f) =>
    `${f.title}. Source maps expose your unminified source + inline comments + TODOs to anyone who visits the .map URL.

For Next.js, in next.config.ts: productionBrowserSourceMaps: false.
For Vite: build.sourcemap: 'hidden' keeps them locally without serving.`,

  "ext/csp-missing": (f) =>
    `${f.title}. No CSP header means no XSS defense layer.

In Next.js middleware or next.config.ts headers(), add:
'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co;"
Tighten one directive at a time; check the browser console for violations.`,

  "ext/csp-unsafe": (f) =>
    `${f.title}. unsafe-inline / unsafe-eval defeats CSP's main job — any XSS can inject a script tag.

Replace inline scripts with nonces. In Next.js, generate a per-request nonce in middleware and include it on every <script> you control.`,

  "ext/hsts-missing": (f) =>
    `${f.title}. Without HSTS, a user's first request can be downgraded to http and intercepted.

Add: 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'.
Don't enable preload unless you're ready for it to be permanent.`,

  "ext/x-content-type-missing": (f) =>
    `${f.title}. Add 'X-Content-Type-Options': 'nosniff' to your response headers. Prevents MIME-sniffing attacks.`,

  "ext/frame-options-missing": (f) =>
    `${f.title}. Without clickjacking protection your page can be iframed by any site.

Add 'X-Frame-Options': 'DENY' or in CSP: 'Content-Security-Policy': "frame-ancestors 'none'".`,

  "ext/runtime-errors": (f) =>
    `${f.title}. AI-generated code often has unhandled promise rejections that pass type-checking but throw at runtime.

1. Open DevTools → Console on this page and look at the most recent errors.
2. For each, add a try/catch and decide: log+recover, or surface via an error boundary?
3. Add a top-level window.addEventListener('unhandledrejection', ...) to report escapees to Sentry.`,

  "ext/pii-in-response": (f) =>
    `${f.title}. An API response is shipping more PII than the page actually needs.

1. Find the API route that returns this data.
2. Add a Drizzle/Prisma .select({...}) projection that returns only the fields the UI uses.
3. Remove email/phone/address from default responses unless the caller has explicit consent.`,

  "ext/error-rate": (f) =>
    `${f.title}. Multiple 4xx/5xx responses on this page.

1. Open DevTools → Network and filter for status 400-599.
2. For each, check: wrong shape from the client? Wrong status from the server? Auth failing silently?
3. AI-generated API code often returns 200 with { error: '...' } body — these will appear here too.`,
};

export const FALLBACK_PROMPT = (f: Finding) =>
  `EDITH found an issue on ${f.url}.

${f.title}

${f.description}

Inspect the relevant code and apply the fix, then reload the page and verify EDITH no longer flags this.`;
