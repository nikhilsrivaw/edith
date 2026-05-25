export type Severity = "critical" | "high" | "medium" | "low";

export type Dimension =
  | "security"
  | "performance"
  | "reliability"
  | "data_safety"
  | "business_logic"
  | "deploy_readiness"
  | "ai_surface"
  | "accessibility"
  | "dependencies"
  | "seo";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  security: "Security",
  performance: "Performance",
  reliability: "Reliability",
  data_safety: "Data Safety",
  business_logic: "Business Logic",
  deploy_readiness: "Deploy Readiness",
  ai_surface: "AI Surface",
  accessibility: "Accessibility",
  dependencies: "Dependencies",
  seo: "SEO",
};

/**
 * Weights used by the EDITH Score. Must sum to 1.0.
 * Tuned for AI-built Next.js apps shipped to prod:
 * Security + AI Surface + Data Safety dominate because they create irrecoverable
 * blast radius (prod incident, bill explosion, data loss). Reliability +
 * Business Logic catch the "looks like it works but doesn't" class. The rest
 * are small constant nudges so they show up in the score but don't drown it.
 */
export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  security: 0.20,
  ai_surface: 0.15,
  data_safety: 0.15,
  reliability: 0.13,
  business_logic: 0.10,
  performance: 0.08,
  deploy_readiness: 0.07,
  accessibility: 0.05,
  dependencies: 0.04,
  seo: 0.03,
};

export type ScanStatus = "completed" | "running" | "queued" | "failed";

export type Issue = {
  id: string;
  title: string;
  severity: Severity;
  dimension: Dimension;
  file: string;
  line: number;
  description: string;
  fixPrompt: string;
};

export type Scan = {
  id: string;
  repoId: string;
  status: ScanStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number;
  commit: string;
  commitMessage: string;
  branch: string;
  prNumber?: number;
  scoreEdith: number;
  scoreTest: number;
  scoreDebt: number;
  dimensionScores: Record<Dimension, number>;
  issues: Issue[];
};

export type Repo = {
  id: string;
  name: string;
  owner: string;
  description: string;
  defaultBranch: string;
  lastScanAt: string;
  latestScore: number;
  scoreDelta: number;
  totalScans: number;
  criticalIssues: number;
  highIssues: number;
  stack: string[];
  autoScan: boolean;
  aiTool: "cursor" | "claude-code" | "windsurf" | "v0";
};

export type Plan = "free" | "builder" | "pro" | "agency";

export const CURRENT_USER = {
  name: "Aditya Srivastav",
  email: "adityasrivastav9721057380@gmail.com",
  avatarInitials: "AS",
  github: "aditya-srivastav",
  plan: "pro" as Plan,
  trialEndsAt: "2026-06-02T00:00:00Z",
};

export const PLAN_META: Record<
  Plan,
  { name: string; priceInr: string; priceUsd: string; repoLimit: string; scanLimit: string }
> = {
  free: { name: "Free", priceInr: "₹0", priceUsd: "$0", repoLimit: "1 repo", scanLimit: "Weekly" },
  builder: {
    name: "Builder",
    priceInr: "₹499",
    priceUsd: "$9",
    repoLimit: "5 repos",
    scanLimit: "Daily",
  },
  pro: {
    name: "Pro",
    priceInr: "₹1,499",
    priceUsd: "$29",
    repoLimit: "Unlimited",
    scanLimit: "Real-time",
  },
  agency: {
    name: "Agency",
    priceInr: "₹3,999",
    priceUsd: "$79",
    repoLimit: "Unlimited",
    scanLimit: "Real-time",
  },
};

/* ============================ REPOS =========================== */

export const REPOS: Repo[] = [
  {
    id: "checkout-app",
    name: "checkout-app",
    owner: "acme",
    description: "Public-facing Next.js storefront with Stripe checkout.",
    defaultBranch: "main",
    lastScanAt: "2026-05-19T18:14:00Z",
    latestScore: 78,
    scoreDelta: +4,
    totalScans: 42,
    criticalIssues: 2,
    highIssues: 5,
    stack: ["Next.js 15", "Stripe", "Supabase"],
    autoScan: true,
    aiTool: "cursor",
  },
  {
    id: "admin-panel",
    name: "admin-panel",
    owner: "acme",
    description: "Internal admin tooling. RBAC-gated, no public surface.",
    defaultBranch: "main",
    lastScanAt: "2026-05-19T16:02:00Z",
    latestScore: 91,
    scoreDelta: +2,
    totalScans: 28,
    criticalIssues: 0,
    highIssues: 1,
    stack: ["Next.js 15", "Supabase", "Drizzle"],
    autoScan: true,
    aiTool: "claude-code",
  },
  {
    id: "marketing-site",
    name: "marketing-site",
    owner: "acme",
    description: "Marketing pages and lead capture, deployed to edge.",
    defaultBranch: "main",
    lastScanAt: "2026-05-19T09:38:00Z",
    latestScore: 64,
    scoreDelta: -6,
    totalScans: 18,
    criticalIssues: 4,
    highIssues: 8,
    stack: ["Next.js 15", "Sanity", "Resend"],
    autoScan: false,
    aiTool: "cursor",
  },
  {
    id: "api-gateway",
    name: "api-gateway",
    owner: "acme",
    description: "Public API + rate limiter sitting in front of services.",
    defaultBranch: "main",
    lastScanAt: "2026-05-18T22:11:00Z",
    latestScore: 88,
    scoreDelta: +1,
    totalScans: 56,
    criticalIssues: 1,
    highIssues: 3,
    stack: ["Next.js 15", "Upstash Redis", "PostgreSQL"],
    autoScan: true,
    aiTool: "cursor",
  },
  {
    id: "mobile-api",
    name: "mobile-api",
    owner: "acme",
    description: "REST endpoints for the React Native app.",
    defaultBranch: "main",
    lastScanAt: "2026-05-18T14:47:00Z",
    latestScore: 72,
    scoreDelta: -2,
    totalScans: 31,
    criticalIssues: 3,
    highIssues: 6,
    stack: ["Next.js 15", "PostgreSQL", "Clerk"],
    autoScan: true,
    aiTool: "windsurf",
  },
  {
    id: "ai-chatbot",
    name: "ai-chatbot",
    owner: "acme",
    description: "Customer-support chatbot built on Claude.",
    defaultBranch: "main",
    lastScanAt: "2026-05-17T19:25:00Z",
    latestScore: 85,
    scoreDelta: +3,
    totalScans: 12,
    criticalIssues: 0,
    highIssues: 2,
    stack: ["Next.js 15", "Claude API", "Vercel KV"],
    autoScan: true,
    aiTool: "claude-code",
  },
];

/* ============================ ISSUES ========================== */

const ISSUE_TEMPLATES: Omit<Issue, "id">[] = [
  {
    title: "Stripe webhook signature not verified",
    severity: "critical",
    dimension: "security",
    file: "app/api/webhooks/stripe/route.ts",
    line: 12,
    description:
      "The webhook handler trusts request bodies without calling stripe.webhooks.constructEvent. Attackers can forge events and mark orders as paid.",
    fixPrompt:
      "In app/api/webhooks/stripe/route.ts, replace the body parsing with a signature check:\n\nimport { stripe } from '@/lib/stripe';\nconst sig = (await headers()).get('stripe-signature');\nconst body = await req.text();\nlet event;\ntry {\n  event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);\n} catch {\n  return new Response('Bad signature', { status: 400 });\n}\n\nMake sure STRIPE_WEBHOOK_SECRET is set in env.",
  },
  {
    title: "Missing RLS policy on `orders` table",
    severity: "critical",
    dimension: "data_safety",
    file: "supabase/migrations/0003_orders.sql",
    line: 24,
    description:
      "The orders table has RLS enabled but no SELECT/INSERT policies. With anon key this means total lockout — but a single permissive policy could leak every order.",
    fixPrompt:
      "Add an RLS policy to supabase/migrations/0004_orders_policy.sql:\n\ncreate policy \"users can read own orders\"\non public.orders for select using (auth.uid() = user_id);\n\ncreate policy \"users can insert own orders\"\non public.orders for insert with check (auth.uid() = user_id);\n\nDo NOT add a permissive policy. Scope by auth.uid() always.",
  },
  {
    title: "Order total recomputed client-side",
    severity: "critical",
    dimension: "business_logic",
    file: "app/checkout/page.tsx",
    line: 47,
    description:
      "The final amount sent to Stripe is computed in the browser from the cart. A malicious client can submit any number — there is no server-side verification.",
    fixPrompt:
      "In app/api/checkout/route.ts, recompute the total server-side from product IDs before calling stripe.checkout.sessions.create. Never trust amount from the client request body.",
  },
  {
    title: "Unbatched DB query in /api/orders/list",
    severity: "high",
    dimension: "performance",
    file: "app/api/orders/list/route.ts",
    line: 8,
    description:
      "For each order returned, a separate query fetches the user. With 100 orders that's 101 queries (classic N+1).",
    fixPrompt:
      "Refactor to a single JOIN or use Drizzle's `with` clause:\n\nconst rows = await db.query.orders.findMany({ with: { user: true } });\n\nThen map rows in-memory. Reduces 100+ round trips to 1.",
  },
  {
    title: "Razorpay test key in client bundle",
    severity: "critical",
    dimension: "security",
    file: "components/razorpay-button.tsx",
    line: 4,
    description:
      "RAZORPAY_KEY_ID is imported into a Client Component, leaking the key into the public bundle. Even a test key signals carelessness.",
    fixPrompt:
      "Move RAZORPAY_KEY_ID access to a Server Action or API route. The browser only needs the order_id returned by your server, not the key.",
  },
  {
    title: "Missing webhook idempotency",
    severity: "high",
    dimension: "reliability",
    file: "app/api/webhooks/razorpay/route.ts",
    line: 21,
    description:
      "When Razorpay retries a webhook (network blip), the same payment will be processed twice. Orders can be double-credited.",
    fixPrompt:
      "Before processing, insert event.id into a webhook_events table with a unique constraint:\n\nawait db.insert(webhookEvents).values({ id: event.id, source: 'razorpay' }).onConflictDoNothing();\nif (insertResult.rowCount === 0) return new Response('Already processed', { status: 200 });",
  },
  {
    title: "Coupon allows negative price",
    severity: "critical",
    dimension: "business_logic",
    file: "app/checkout/coupon.ts",
    line: 18,
    description:
      "Coupon code DISCOUNT_LIFE_99 subtracts 99% but isn't capped at zero. A combination of stacked coupons can yield a negative final amount.",
    fixPrompt:
      "Clamp the final amount: `return Math.max(0, subtotal - discount);` and refuse to send orders with amount <= 0 to the payment provider.",
  },
  {
    title: "PII logged unredacted to Vercel logs",
    severity: "high",
    dimension: "data_safety",
    file: "lib/log.ts",
    line: 11,
    description:
      "User email and phone are logged on every API call. Vercel logs are searchable by anyone with team access.",
    fixPrompt:
      "Add a redact helper:\n\nfunction redact(s: string) { return s.replace(/[\\w.+-]+@[\\w-]+\\.[\\w-]+/g, '[email]').replace(/\\b\\d{10}\\b/g, '[phone]'); }\n\nApply it before console.log in lib/log.ts.",
  },
  {
    title: "Build warnings ignored in CI",
    severity: "medium",
    dimension: "deploy_readiness",
    file: ".github/workflows/ci.yml",
    line: 14,
    description:
      "`next build` exits 0 on type warnings. Multiple `any` casts have slipped into the main branch over the past month.",
    fixPrompt:
      "Add a strict step to CI:\n\n- run: pnpm tsc --noEmit\n\nThis treats type errors as build failures separately from `next build`.",
  },
  {
    title: "No retry on flaky external API",
    severity: "medium",
    dimension: "reliability",
    file: "lib/email.ts",
    line: 31,
    description:
      "Calls to Resend fail ~0.4% of the time. No retry means those notifications never go out.",
    fixPrompt:
      "Wrap the Resend call in a retry helper with exponential backoff. Use `p-retry` package:\n\nawait pRetry(() => resend.emails.send(payload), { retries: 3, minTimeout: 500 });",
  },
  {
    title: "Large image not using next/image",
    severity: "low",
    dimension: "performance",
    file: "app/page.tsx",
    line: 89,
    description:
      "Hero image is a 2.4MB PNG served via <img>. No responsive sizes, no AVIF conversion.",
    fixPrompt:
      "Replace `<img src='/hero.png' />` with:\n\nimport Image from 'next/image';\n<Image src='/hero.png' width={1200} height={600} alt='...' priority />",
  },
  {
    title: "Missing health check endpoint",
    severity: "medium",
    dimension: "deploy_readiness",
    file: "app/",
    line: 1,
    description:
      "No /api/health route. Vercel can't tell a stuck deploy from a slow one; PagerDuty alerts on 500s only.",
    fixPrompt:
      "Add app/api/health/route.ts that pings the DB and returns:\n\nexport async function GET() {\n  try { await db.execute(sql`select 1`); return Response.json({ ok: true }); }\n  catch { return Response.json({ ok: false }, { status: 503 }); }\n}",
  },
];

function makeIssues(count: number, scanId: string): Issue[] {
  return Array.from({ length: count }, (_, i) => {
    const tpl = ISSUE_TEMPLATES[i % ISSUE_TEMPLATES.length];
    return { ...tpl, id: `${scanId}-iss-${i + 1}` };
  });
}

/* ============================ SCANS =========================== */

function makeScan(
  repo: Repo,
  index: number,
  daysAgo: number,
  scoreOverride?: number,
  issueCount = 9,
): Scan {
  const startedAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const score = scoreOverride ?? repo.latestScore;
  const scanId = `${repo.id}-scan-${index}`;
  return {
    id: scanId,
    repoId: repo.id,
    status: "completed",
    startedAt,
    finishedAt: new Date(
      Date.now() - daysAgo * 86_400_000 + 48_000,
    ).toISOString(),
    durationMs: 48_000,
    commit:
      ["a3f9c2e", "b71f4dd", "0c1a9bf", "f24e7c3", "9d8e6a1", "5b2f0c8"][
        index % 6
      ],
    commitMessage: [
      "feat: add coupon stacking",
      "fix: webhook retry on 5xx",
      "refactor: extract checkout helpers",
      "chore: bump @stripe/stripe-js",
      "fix: redact email in logs",
      "feat: bulk order export",
    ][index % 6],
    branch: index === 0 ? "main" : ["pr/42", "pr/41", "main", "pr/40"][index % 4],
    prNumber: index === 0 ? undefined : 42 - index,
    scoreEdith: score,
    scoreTest: Math.max(40, Math.min(100, score - 6 + ((index * 3) % 10))),
    scoreDebt: Math.max(30, Math.min(100, score + 4 - ((index * 5) % 12))),
    dimensionScores: {
      security: Math.max(40, Math.min(100, score + 5 - ((index * 7) % 14))),
      performance: Math.max(40, Math.min(100, score - 4 + ((index * 3) % 10))),
      reliability: Math.max(40, Math.min(100, score + 1 + ((index * 2) % 8))),
      data_safety: Math.max(40, Math.min(100, score + 7 - ((index * 5) % 16))),
      business_logic: Math.max(
        40,
        Math.min(100, score - 2 + ((index * 4) % 12)),
      ),
      deploy_readiness: Math.max(
        40,
        Math.min(100, score + 3 - ((index * 6) % 11)),
      ),
      ai_surface: Math.max(35, Math.min(100, score - 8 + ((index * 9) % 18))),
      accessibility: Math.max(35, Math.min(100, score - 12 + ((index * 4) % 22))),
      dependencies: Math.max(40, Math.min(100, score + 2 - ((index * 3) % 10))),
      seo: Math.max(30, Math.min(100, score - 10 + ((index * 11) % 24))),
    },
    issues: makeIssues(issueCount, scanId),
  };
}

export const SCANS: Scan[] = REPOS.flatMap((r) => {
  const issueCount =
    r.criticalIssues + r.highIssues + Math.max(0, 4 - r.criticalIssues);
  return [
    makeScan(r, 0, 0, r.latestScore, issueCount),
    makeScan(r, 1, 1, r.latestScore - r.scoreDelta, issueCount + 1),
    makeScan(r, 2, 3, r.latestScore - r.scoreDelta - 2, issueCount + 2),
    makeScan(r, 3, 6, r.latestScore - r.scoreDelta - 5, issueCount + 3),
    makeScan(r, 4, 10, r.latestScore - r.scoreDelta - 4, issueCount + 1),
  ];
});

/* ============================ HELPERS ========================= */

export function getRepo(id: string): Repo | undefined {
  return REPOS.find((r) => r.id === id);
}

export function getRepoScans(repoId: string): Scan[] {
  return SCANS.filter((s) => s.repoId === repoId).sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export function getScan(scanId: string): Scan | undefined {
  return SCANS.find((s) => s.id === scanId);
}

export function getLatestScan(repoId: string): Scan | undefined {
  return getRepoScans(repoId)[0];
}

export function aggregateStats() {
  const totalRepos = REPOS.length;
  const totalScans = SCANS.length;
  const openCritical = REPOS.reduce((s, r) => s + r.criticalIssues, 0);
  const avgScore = Math.round(
    REPOS.reduce((s, r) => s + r.latestScore, 0) / REPOS.length,
  );
  return { totalRepos, totalScans, openCritical, avgScore };
}
