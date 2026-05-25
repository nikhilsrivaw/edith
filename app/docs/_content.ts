/**
 * Docs content registry.
 *
 * Single source of truth for every documentation article. The index page
 * (/docs) and every article page (/docs/[slug]) reads from this object so
 * URLs, titles, and link counts stay in sync.
 *
 * Body content uses very lightweight markdown-style markup that the article
 * renderer understands:
 *   - paragraphs split on blank lines
 *   - lines starting with "- " become bullets
 *   - lines starting with "1. " become ordered list items
 *   - lines starting with "> " become a callout
 *   - inline `code` becomes <code>
 *   - **bold** wraps in <strong>
 */
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Briefcase,
  Code2,
  Globe,
  KeyRound,
  Plug,
  ScrollText,
  Shield,
  ShieldCheck,
  Webhook,
  Zap,
} from "lucide-react";

export type DocSection = {
  id: string;
  title: string;
  body: string;
  code?: string;
  codeLang?: string;
};

export type DocArticle = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  estimatedRead: string;
  sections: DocSection[];
  related: string[];
};

export const DOCS: DocArticle[] = [
  /* ─────────────────────────────────────────────────────── */
  {
    slug: "getting-started",
    title: "Getting started",
    description:
      "Connect GitHub, run your first scan, read the score, copy a fix prompt. Five minutes.",
    icon: Zap,
    estimatedRead: "5 min",
    sections: [
      {
        id: "install",
        title: "Install the EDITH GitHub App",
        body: `Sign in to EDITH at app.edith.expert/signin with your GitHub account. Click **Install on a repository** in the onboarding flow.

EDITH requests read-only access — we never write to your repo or open PRs you didn't approve. You can revoke access in one click from your GitHub settings.

> Heads up: EDITH currently scans up to 400 files per repo. Larger codebases are batched.`,
      },
      {
        id: "first-scan",
        title: "Run your first scan",
        body: `Open the EDITH dashboard, pick the repo you just connected, and click **Scan now**. EDITH fetches the latest commit on the default branch, builds an in-memory ts-morph project, and runs all 151 deterministic checks plus the AI-pattern checker.

Median scan time is 60 seconds. p95 is around 4 minutes for repos near the 400-file cap.`,
      },
      {
        id: "score",
        title: "Read the EDITH score",
        body: `Every scan produces three scores:

- **EDITH score** — weighted across all 6 dimensions, the headline number on the dashboard.
- **Test score** — heavily penalised by critical findings; reflects production readiness.
- **Debt score** — total finding count normalised; reflects long-term codebase health.

Below the score, findings group by dimension (Security, Performance, Reliability, Data Safety, Business Logic, Deploy Ready) and severity (critical, high, medium, low).`,
      },
      {
        id: "fix-prompt",
        title: "Copy a fix prompt",
        body: `Each finding has a **Copy fix prompt** button. The clipboard receives a precise, scoped prompt with the file, line, the pattern that broke, and the acceptance criteria.

Paste the prompt into Cursor / Claude Code / Copilot / Windsurf. Review the patch. Commit. EDITH re-scans automatically on push.`,
        code: `# EDITH fix prompt — Stripe webhook signature verification
Issue: api/webhooks/stripe.ts:12 — handler reads req.json() and
       trusts the body. An attacker can fake events.

Fix: Use stripe.webhooks.constructEvent() with the stripe-signature
header and STRIPE_WEBHOOK_SECRET. Reject anything that fails
verification.

Acceptance:
- A request without a valid signature returns 400
- The handler runs on the verified event object
- Add an idempotency check before applying side effects`,
        codeLang: "markdown",
      },
      {
        id: "next-steps",
        title: "Where to go next",
        body: `- Browse **Scanner checks** to see every rule EDITH runs
- Install the **Browser extension** to audit pages live in DevTools
- Wire up **GitHub webhooks** so every push triggers a scan
- Read the **Compliance** docs if you need audit-ready evidence`,
      },
    ],
    related: ["checks", "webhooks", "extension"],
  },

  /* ─────────────────────────────────────────────────────── */
  {
    slug: "checks",
    title: "Scanner checks",
    description:
      "All 151 deterministic checks across security, performance, reliability, data, business logic, and deploy.",
    icon: Shield,
    estimatedRead: "12 min",
    sections: [
      {
        id: "overview",
        title: "How checks are organised",
        body: `EDITH ships **151 deterministic checks** organised into 6 dimensions plus an AI-pattern bucket. Every check has a stable \`checkId\` (e.g. \`security/jwt-in-localstorage\`) that you can reference from custom rules, the API, and the audit log.

Every check is **pure** — same input, same finding, every time. We never call an LLM to evaluate your code unless you explicitly opt into a custom rule that requires it.`,
      },
      {
        id: "dimensions",
        title: "Six dimensions",
        body: `- **Security (48)** — auth gaps, secrets in client bundles, SSRF, prototype pollution, JWT issues, CSRF, missing role checks
- **Performance (22)** — LLM cost-leaks, N+1 queries, layout shifts, useEffect anti-patterns
- **Reliability (30)** — silent catches, stale closures, floating promises, missing route boundaries
- **Data Safety (18)** — RLS, PII leakage, schema invariants, GDPR rights endpoints
- **Business Logic (18)** — webhook idempotency, money flows, tool allowlists, password reset reuse
- **Deploy Ready (15)** — env vars, lockfile, engines pin, hallucinated imports`,
      },
      {
        id: "ai-pattern",
        title: "AI-pattern checks",
        body: `On top of the universal checks, EDITH runs a separate AI-pattern bucket tuned to the specific failure modes Cursor / Claude / v0 / Lovable / Bolt produce. See the AI-pattern detection docs for the per-tool rules.`,
      },
      {
        id: "severity",
        title: "Severity model",
        body: `Findings get one of four severities — each subtracts from your score with a different weight:

- **Critical (-18)** — exploitable, will cause an outage or breach
- **High (-9)** — likely to bite within a release cycle
- **Medium (-4)** — worth fixing soon
- **Low (-1)** — nice-to-have

The score is clamped to 0–100 per dimension, then a weighted average becomes the EDITH score.`,
      },
      {
        id: "false-positives",
        title: "Tuning + dismissals",
        body: `Every check is conservative by default — we'd rather miss something than cry wolf. If a finding doesn't apply to your codebase, dismiss it once and EDITH will remember.

Dismissals are per-org and per-checkId-per-file. They survive re-scans. The audit log records every dismissal.`,
      },
    ],
    related: ["ai-patterns", "custom-rules", "compliance"],
  },

  /* ─────────────────────────────────────────────────────── */
  {
    slug: "ai-patterns",
    title: "AI-pattern detection",
    description:
      "How EDITH fingerprints Cursor, Claude, v0, Lovable, Bolt and runs targeted rules per tool.",
    icon: Bot,
    estimatedRead: "7 min",
    sections: [
      {
        id: "fingerprinting",
        title: "How fingerprinting works",
        body: `EDITH scans for tool-specific signatures in files — \`@cursor:generated\` comments, \`// generated by v0.dev\` markers, Lovable's div attributes, Bolt's URL hints, Claude's commit signatures.

When a tool is detected, EDITH runs that tool's rule pack on top of the universal checks. The dashboard surfaces which tool wrote each finding so you can see patterns.`,
      },
      {
        id: "cursor",
        title: "Cursor catches",
        body: `Cursor's most common failure modes:

- Hallucinated package names that don't exist on npm
- Outdated model strings (\`gpt-3.5-turbo\`, \`claude-3-opus-20240229\`)
- \`process.env.X\` referenced from a \`"use client"\` file without the \`NEXT_PUBLIC_\` prefix
- Server Actions exported with no \`await getUser()\` gate
- \`useEffect\` deps containing object literals (infinite loop)`,
      },
      {
        id: "claude",
        title: "Claude Code catches",
        body: `Claude's footguns:

- Silent catches around \`JSON.parse\` and \`fetch\`
- Floating promises in async handlers
- \`FIXME\` / \`TODO\` / \`HACK\` comments left in code shipped to PR
- \`useEffect\` with inline-object dependency`,
      },
      {
        id: "v0",
        title: "v0 catches",
        body: `v0 ships beautiful UI but its accessibility is consistently weak:

- Missing \`alt\` attributes on \`<img>\`
- \`<div onClick>\` used as a button (no role, no keyboard)
- Heading skips (\`<h1>\` → \`<h3>\`)
- Form \`<input>\` without an associated \`<label>\``,
      },
      {
        id: "lovable",
        title: "Lovable + Bolt catches",
        body: `Lovable and Bolt are great at first-cut full-stack apps but consistently miss the security baseline:

- Tables created without RLS
- Stripe webhook handlers without \`constructEvent\` signature check
- JWT stored in localStorage instead of HttpOnly cookies
- Multi-table writes outside a transaction`,
      },
    ],
    related: ["checks", "custom-rules"],
  },

  /* ─────────────────────────────────────────────────────── */
  {
    slug: "compliance",
    title: "Compliance",
    description:
      "PCI-DSS, SOC 2, GDPR, Play Store, App Store. 62 controls, 295+ mappings.",
    icon: ShieldCheck,
    estimatedRead: "9 min",
    sections: [
      {
        id: "overview",
        title: "What's covered",
        body: `EDITH maps every finding to specific controls across **5 compliance frameworks**:

- **PCI-DSS 4.0** — 16 controls (injection, broken auth, encryption, secure transmission)
- **SOC 2** — 10 controls (logical access, data restriction, monitoring, change management)
- **GDPR** — 14 controls (security obligations, data minimisation, erasure, portability, consent)
- **Google Play Store** — 11 controls (data safety form, secure transmission, session mgmt, accessibility)
- **Apple App Store** — 11 controls (ATS, keychain, session, review guidelines 5.1.1 / 5.1.2)

Total: **62 controls, 295+ check↔control mappings**.`,
      },
      {
        id: "evidence",
        title: "Evidence reports",
        body: `Pro and Agency plans generate a signed PDF that maps every finding to the framework controls it violates or satisfies. The report includes:

- Per-framework pass/fail percentage
- Per-control evidence with check ID + scan timestamp
- Continuous scan history
- White-label option (Agency tier)

Hand it to your SOC 2 auditor on day one.`,
      },
      {
        id: "dashboard",
        title: "Live compliance dashboard",
        body: `Signed-in users see live compliance status at \`/audit\` with per-framework percentages and per-control evidence. Drill into any framework to see which checks back which controls.`,
      },
      {
        id: "limits",
        title: "What EDITH can and can't certify",
        body: `EDITH covers the **development-facing** controls. We can't evaluate:

- Process controls (MFA enforcement, incident response, training)
- Physical security
- Vendor management

For a full audit you still need a human. EDITH compresses the developer evidence collection from weeks to one button.`,
      },
    ],
    related: ["checks", "audit-log"],
  },

  /* ─────────────────────────────────────────────────────── */
  {
    slug: "webhooks",
    title: "GitHub webhooks",
    description:
      "Push + PR triggers, signature verification, what happens on every commit.",
    icon: Webhook,
    estimatedRead: "4 min",
    sections: [
      {
        id: "flow",
        title: "The webhook flow",
        body: `When you install the EDITH GitHub App, a webhook fires on every \`push\` and \`pull_request\` event. The flow:

1. GitHub sends the event to \`/api/github/webhook\`
2. EDITH verifies the signature (\`x-hub-signature-256\`)
3. We enqueue an Inngest scan event
4. A worker picks it up, runs the scan, posts a PR comment with findings + score`,
      },
      {
        id: "signature",
        title: "Signature verification",
        body: `Every webhook is signed with HMAC-SHA256 using your installation's secret. EDITH rejects any request that fails verification with HTTP 401 and logs the attempt to the audit log.`,
      },
      {
        id: "pr-comment",
        title: "PR comments",
        body: `On every PR, EDITH posts (or updates) a single comment with:

- Headline score
- Findings grouped by severity
- Drift vs the base branch (newly introduced issues)
- One **Copy fix prompt** button per finding

The comment updates in-place on every new commit to the PR.`,
      },
    ],
    related: ["getting-started", "api"],
  },

  /* ─────────────────────────────────────────────────────── */
  {
    slug: "extension",
    title: "Browser extension",
    description:
      "Install, connect to your account, the live DevTools panel.",
    icon: Globe,
    estimatedRead: "5 min",
    sections: [
      {
        id: "install",
        title: "Install",
        body: `1. Open \`chrome://extensions\` (or \`edge://extensions\` / \`brave://extensions\`)
2. Toggle **Developer mode**
3. **Load unpacked** → select the \`extension/\` folder from the EDITH repo (or install from the Chrome Web Store once published)
4. Pin EDITH to the toolbar

Minimum Chrome 111. Works on localhost too.`,
      },
      {
        id: "popup",
        title: "Popup audit",
        body: `Click the EDITH icon to audit the current tab. The popup shows:

- Live score (0–100) based on DOM, cookies, headers, network observations
- Per-finding severity, file/line where relevant
- A **Copy fix prompt** for each issue
- History of recently scanned pages`,
      },
      {
        id: "devtools",
        title: "DevTools panel",
        body: `Open Chrome DevTools and switch to the **EDITH** tab — next to Console / Network / Application.

The panel captures every network request and console message in real time, annotates each request with EDITH findings (cookies missing HttpOnly, mixed content, slow response, large response, PII in body), and surfaces console errors with PII fingerprinting.

The DevTools panel is the deepest live audit surface — see runtime issues the static scan can't see.`,
      },
      {
        id: "connect",
        title: "Connect to your EDITH account",
        body: `Click **Connect to your EDITH account** in the popup, paste your API token (generate one at /settings), and findings sync to your dashboard for cross-device visibility.`,
      },
    ],
    related: ["getting-started", "api"],
  },

  /* ─────────────────────────────────────────────────────── */
  {
    slug: "mcp",
    title: "MCP server",
    description:
      "Connect Claude / Cursor / Windsurf to EDITH via the Model Context Protocol.",
    icon: Plug,
    estimatedRead: "6 min",
    sections: [
      {
        id: "endpoint",
        title: "Endpoint",
        body: `EDITH exposes an MCP server at \`/api/mcp\`. Any MCP-compatible client (Claude Desktop, Cursor, Windsurf, Zed, etc.) can connect with bearer-token auth.`,
        code: `// claude_desktop_config.json
{
  "mcpServers": {
    "edith": {
      "url": "https://app.edith.expert/api/mcp",
      "headers": {
        "Authorization": "Bearer edith_..."
      }
    }
  }
}`,
        codeLang: "json",
      },
      {
        id: "tools",
        title: "Available tools",
        body: `MCP tools exposed:

- \`list_repos\` — your connected GitHub repos
- \`get_score\` — latest EDITH score for a repo
- \`run_scan\` — kick off a fresh scan
- \`list_issues\` — issues for a repo, filtered by severity/dimension
- \`get_fix_prompt\` — generate a fix prompt for a specific finding
- \`get_compliance_status\` — per-framework status`,
      },
      {
        id: "auth",
        title: "Tokens",
        body: `Generate a token at \`/settings/api-tokens\`. Tokens are scoped to your org and can be rotated or revoked at any time. Every MCP call is logged to the audit log.`,
      },
    ],
    related: ["api", "extension"],
  },

  /* ─────────────────────────────────────────────────────── */
  {
    slug: "custom-rules",
    title: "Custom rules",
    description:
      "Write project-specific checks in edith.config.json. Pattern, AST, and LLM-backed.",
    icon: Code2,
    estimatedRead: "5 min",
    sections: [
      {
        id: "config",
        title: "edith.config.json",
        body: `Drop an \`edith.config.json\` at your repo root. EDITH picks it up on every scan and runs your custom rules alongside the built-ins.`,
        code: `{
  "$schema": "https://app.edith.expert/schemas/edith-config.json",
  "rules": [
    {
      "id": "team/no-console-in-server",
      "severity": "medium",
      "dimension": "reliability",
      "pattern": "console\\\\.(log|error|warn)\\\\(",
      "scope": "app/api/**",
      "message": "Use the structured logger, not console."
    }
  ]
}`,
        codeLang: "json",
      },
      {
        id: "pattern",
        title: "Pattern rules",
        body: `The simplest rule type — a regex pattern that fires per match. Useful for banned imports, deprecated APIs, hardcoded values.`,
      },
      {
        id: "ast",
        title: "AST rules",
        body: `For structural checks, target ts-morph node types directly. Example: every \`fetch\` call without an \`AbortSignal\`.`,
        code: `{
  "id": "team/fetch-needs-abort",
  "ast": {
    "kind": "CallExpression",
    "callee": "fetch",
    "missingArg": "AbortSignal"
  }
}`,
        codeLang: "json",
      },
      {
        id: "llm",
        title: "LLM-backed rules",
        body: `For checks that need reasoning, use \`prompt\` — EDITH wraps Claude to evaluate matching files. Use sparingly; costs money per scan.`,
      },
    ],
    related: ["checks", "ai-patterns"],
  },

  /* ─────────────────────────────────────────────────────── */
  {
    slug: "api",
    title: "API + tokens",
    description:
      "Bearer-token REST API for scans, issues, scores. Rotate keys.",
    icon: KeyRound,
    estimatedRead: "8 min",
    sections: [
      {
        id: "auth",
        title: "Authentication",
        body: `Every request needs an Authorization header with a bearer token. Generate tokens at /settings/api-tokens.`,
        code: `curl https://app.edith.expert/api/v1/repos \\
  -H "Authorization: Bearer edith_..."`,
        codeLang: "bash",
      },
      {
        id: "endpoints",
        title: "Endpoints",
        body: `- \`GET /api/v1/repos\` — list connected repos
- \`POST /api/v1/repos/:id/scan\` — kick off a scan
- \`GET /api/v1/repos/:id/scans/:scanId\` — scan details
- \`GET /api/v1/repos/:id/issues\` — issues with filters
- \`GET /api/v1/issues/:id\` — single issue
- \`POST /api/v1/issues/:id/dismiss\` — dismiss a finding
- \`GET /api/v1/compliance/:framework\` — framework status`,
      },
      {
        id: "rate-limits",
        title: "Rate limits",
        body: `- **Free** — 60 requests / minute
- **Builder** — 300 / minute
- **Pro / Agency** — 1000 / minute

Excess returns \`429\` with a \`Retry-After\` header.`,
      },
      {
        id: "errors",
        title: "Errors",
        body: `Errors use standard HTTP codes with a JSON body:

- \`400\` — invalid input (zod validation error)
- \`401\` — missing/invalid token
- \`403\` — token lacks scope for this resource
- \`404\` — not found
- \`429\` — rate-limited
- \`5xx\` — server fault (we log + page oncall)`,
      },
    ],
    related: ["mcp"],
  },

  /* ─────────────────────────────────────────────────────── */
  {
    slug: "teams",
    title: "Teams + billing",
    description:
      "Invite teammates, set roles, manage workspaces. PayU / Stripe.",
    icon: Briefcase,
    estimatedRead: "4 min",
    sections: [
      {
        id: "invite",
        title: "Invite teammates",
        body: `Open \`/team\` and click **Invite**. Enter an email and pick a role. EDITH sends an invitation link valid for 7 days.`,
      },
      {
        id: "roles",
        title: "Roles",
        body: `- **Owner** — full access including billing
- **Admin** — repos, settings, members; no billing
- **Member** — read findings, dismiss issues, run scans
- **Viewer** — read-only`,
      },
      {
        id: "billing",
        title: "Billing",
        body: `Pricing is per workspace, not per seat — invite your whole team without paying per head. Billing in INR via **PayU** or USD via **Stripe**. Change plans or cancel any time at \`/settings/billing\`.`,
      },
    ],
    related: ["audit-log", "api"],
  },

  /* ─────────────────────────────────────────────────────── */
  {
    slug: "audit-log",
    title: "Audit log",
    description:
      "Every action recorded for SOC 2 + your peace of mind.",
    icon: ScrollText,
    estimatedRead: "2 min",
    sections: [
      {
        id: "what",
        title: "What's logged",
        body: `Every action that mutates state hits the audit log. That includes:

- Member invites, role changes, removals
- Repo connections / disconnections
- Scan kickoffs (manual + automated)
- Dismissals
- API token creation / rotation / revocation
- MCP calls
- Billing changes`,
      },
      {
        id: "retention",
        title: "Retention",
        body: `Free + Builder: 30 days. Pro: 1 year. Agency: 3 years. Audit log entries are append-only — they cannot be edited or deleted by anyone, including owners. This is by design — auditors look for this.`,
      },
      {
        id: "export",
        title: "Export",
        body: `Export to CSV from \`/audit-log\`. Pro+ plans get a daily JSON export to S3 / R2 for long-term retention.`,
      },
    ],
    related: ["teams", "compliance"],
  },
];

/** Get article by slug. */
export function getDoc(slug: string): DocArticle | undefined {
  return DOCS.find((d) => d.slug === slug);
}

/** Adjacent articles for prev/next nav. */
export function getNeighbours(slug: string) {
  const idx = DOCS.findIndex((d) => d.slug === slug);
  if (idx === -1) return { prev: undefined, next: undefined };
  return {
    prev: idx > 0 ? DOCS[idx - 1] : undefined,
    next: idx < DOCS.length - 1 ? DOCS[idx + 1] : undefined,
  };
}
