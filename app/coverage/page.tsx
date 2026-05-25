"use client";
import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  Database,
  GitBranch,
  Rocket,
  Search,
  Shield,
  Sparkles as SparkleIcon,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

import { NavBar } from "@/components/edith/nav-bar";
import { PageBackground } from "@/components/edith/page-background";
import { GithubMark } from "@/components/edith/github-mark";
import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { MagicCard } from "@/components/spectrum-ui/magic-card";
import { NumberTicker } from "@/components/spectrum-ui/number-ticker";

type Dimension = {
  icon: LucideIcon;
  name: string;
  count: number;
  blurb: string;
  examples: string[];
};

const DIMS: Dimension[] = [
  {
    icon: Shield,
    name: "Security",
    count: 48,
    blurb: "Auth gaps, secrets in client, OWASP-grade scans.",
    examples: [
      "Stripe / Razorpay keys in client bundles",
      "Server Actions with no auth check",
      "JWT in localStorage",
      "OAuth callback missing state check",
      "SSRF in fetch()",
      "Prototype pollution via Object.assign",
      "Missing CSRF on state-changing routes",
      "Production source maps published",
    ],
  },
  {
    icon: Zap,
    name: "Performance",
    count: 22,
    blurb: "Cost-leaks, N+1, layout shifts, bundle bloat.",
    examples: [
      "LLM call with no max_tokens",
      "LLM call inside useEffect",
      "Embedding endpoint with no cache",
      "Await inside DB loop (N+1)",
      "<Image> without width / height",
      "useState(expensive())",
      "SELECT * queries",
      "FK column without index",
    ],
  },
  {
    icon: Activity,
    name: "Reliability",
    count: 30,
    blurb: "AI-pattern stale catches, race conditions, async.",
    examples: [
      "Silent catch blocks",
      "useEffect stale closure",
      "Floating promise",
      "Next 15 cookies() not awaited",
      "Missing AbortController on streaming",
      "await res.json() with no .ok check",
      "Pointless catch + rethrow",
      "Missing loading.tsx / error.tsx",
    ],
  },
  {
    icon: Database,
    name: "Data Safety",
    count: 18,
    blurb: "RLS, PII leakage, schema invariants, GDPR.",
    examples: [
      "Tables without RLS",
      "Plain 'password' column",
      "PII in response body",
      "PII in console logs",
      "Multi-table writes without transaction",
      "UNIQUE missing on email column",
      "created_at without default now()",
      "No /api/account/delete (Art 17)",
    ],
  },
  {
    icon: GitBranch,
    name: "Business Logic",
    count: 18,
    blurb: "Race conditions, idempotency, money flows.",
    examples: [
      "Webhook with no dedup / idempotency",
      "Currency from client",
      "Admin route without role check",
      "Tool dispatcher with no allowlist",
      "Bcrypt rounds < 10",
      "Math.random for tokens",
      "Reset token reusable after use",
      "Email HTML injection",
    ],
  },
  {
    icon: Rocket,
    name: "Deploy Ready",
    count: 15,
    blurb: "What breaks the first production push.",
    examples: [
      "process.env.X in client component",
      "output: 'export' with route handlers",
      "No engines.node pin",
      "Missing lockfile",
      "Env var typo (Levenshtein-based)",
      "Hallucinated import",
      "Missing /robots.txt + sitemap",
      "No health endpoint",
    ],
  },
];

const AI_TOOL_CATCHES: { tool: string; color: string; examples: string[] }[] = [
  {
    tool: "Cursor",
    color: "#34D399",
    examples: [
      "Hallucinated package names",
      "Outdated model name strings (gpt-3.5-turbo, claude-3-opus-20240229)",
      "process.env in 'use client'",
      "Server Action with no auth gate",
    ],
  },
  {
    tool: "Claude Code",
    color: "#FFB627",
    examples: [
      "Silent catches around JSON.parse",
      "Floating promises in async handlers",
      "FIXME / TODO comments left in PRs",
      "useEffect with object-literal dep",
    ],
  },
  {
    tool: "v0",
    color: "#F472B6",
    examples: [
      "Missing alt attributes on <img>",
      "<div onClick> used as button",
      "Heading skips (h1 → h3)",
      "Form inputs without labels",
    ],
  },
  {
    tool: "Lovable",
    color: "#FB923C",
    examples: [
      "Tables created without RLS",
      "Stripe webhook without constructEvent",
      "JWT stored in localStorage",
      "Multi-table writes without $transaction",
    ],
  },
];

export default function CoveragePage() {
  return (
    <>
      <PageBackground />
      <NavBar />
      <main className="relative z-10 flex-1 overflow-x-hidden">
        <Hero />
        <Stats />
        <Dimensions />
        <AiCatches />
        <Cta />
        <Footer />
      </main>
    </>
  );
}

function Hero() {
  return (
    <section className="relative pt-14">
      <div className="mx-auto max-w-6xl px-6 pb-12 pt-20 lg:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            <Search className="h-3 w-3" />
            Coverage · 151 deterministic checks
          </div>
          <h1 className="mt-6 text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] text-[var(--text)] sm:text-[60px]">
            Every check we run on your{" "}
            <span className="text-[var(--accent)]">AI-built app.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15.5px] leading-[1.6] text-[var(--text-dim)]">
            151 deterministic rules across security, performance, reliability,
            data safety, business logic, and deploy readiness — plus
            AI-pattern checks that fire on the bugs Cursor, Claude, v0 and
            Lovable ship most often. Same input, same finding, every time. No
            LLM tax on your scans.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function Stats() {
  const stats: { value: number; suffix?: string; label: string }[] = [
    { value: 151, label: "Deterministic checks" },
    { value: 6, label: "Coverage dimensions" },
    { value: 5, label: "Compliance frameworks" },
    { value: 60, suffix: "s", label: "p50 scan time" },
  ];
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="relative pl-5">
            <span
              aria-hidden
              className="absolute left-0 top-1 h-4 w-[2px] bg-[var(--accent)]"
            />
            <div className="font-mono text-[36px] font-semibold leading-none tabular-nums text-[var(--text)]">
              <NumberTicker value={s.value} duration={1600} suffix={s.suffix ?? ""} />
            </div>
            <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Dimensions() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-7 max-w-2xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            By dimension
          </div>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            What we cover.
          </h2>
          <p className="mt-3 text-[14px] leading-[1.6] text-[var(--text-dim)]">
            Every check belongs to one of six dimensions. Each dimension has
            its own weight in the EDITH score, so a critical security finding
            costs more than a low-severity performance hint.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DIMS.map((d, i) => (
            <motion.div
              key={d.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.06 }}
            >
              <MagicCard className="h-full p-6">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="h-4 w-[2px] bg-[var(--accent)]"
                  />
                  <d.icon
                    className="h-4 w-4 text-[var(--accent)]"
                    strokeWidth={1.75}
                  />
                  <h3 className="text-[16px] font-semibold tracking-tight text-[var(--text)]">
                    {d.name}
                  </h3>
                  <span className="ml-auto rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[9.5px] font-semibold tabular-nums text-[var(--accent)]">
                    {d.count}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-[1.55] text-[var(--text-dim)]">
                  {d.blurb}
                </p>
                <ul className="mt-5 space-y-2 border-t border-[var(--border)] pt-4">
                  {d.examples.map((ex) => (
                    <li
                      key={ex}
                      className="flex items-start gap-2 text-[12.5px] leading-[1.5] text-[var(--text)]"
                    >
                      <Check
                        className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]"
                        strokeWidth={2.5}
                      />
                      {ex}
                    </li>
                  ))}
                </ul>
              </MagicCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiCatches() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-7 max-w-2xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            AI-aware
          </div>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            Catches per AI tool.
          </h2>
          <p className="mt-3 text-[14px] leading-[1.6] text-[var(--text-dim)]">
            EDITH fingerprints the AI tool that wrote each file and runs
            tool-specific rules on top of the universal checks. Below is what
            each tool gets wrong most often — and what EDITH catches on every
            commit.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {AI_TOOL_CATCHES.map((t, i) => (
            <motion.div
              key={t.tool}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: (i % 2) * 0.06 }}
            >
              <SpotlightCard
                className="h-full p-6"
                color={`color-mix(in srgb, ${t.color} 18%, transparent)`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: t.color }}
                  />
                  <Bot
                    className="h-4 w-4"
                    style={{ color: t.color }}
                    strokeWidth={1.75}
                  />
                  <h3 className="text-[18px] font-semibold tracking-tight text-[var(--text)]">
                    {t.tool}
                  </h3>
                  <span
                    className="ml-auto rounded-md border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em]"
                    style={{
                      color: t.color,
                      borderColor: `color-mix(in srgb, ${t.color} 40%, transparent)`,
                      background: `color-mix(in srgb, ${t.color} 10%, transparent)`,
                    }}
                  >
                    Tuned
                  </span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {t.examples.map((ex) => (
                    <li
                      key={ex}
                      className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-[var(--text)]"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                        style={{ background: t.color }}
                      />
                      {ex}
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
          <SparkleIcon className="h-3 w-3" />
          14-day Pro trial · no card needed
        </div>
        <h2 className="mt-5 text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--text)] sm:text-[42px]">
          See it on{" "}
          <span className="text-[var(--accent)]">your repo.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.6] text-[var(--text-dim)]">
          Connect GitHub, run a scan on your last commit, and see every
          check that fires on your actual code in under 60 seconds.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Link
            href="/signin"
            className="group inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] shadow-[0_0_30px_-10px_var(--accent-glow)] transition-all hover:brightness-110"
          >
            <GithubMark className="h-3.5 w-3.5" />
            Connect GitHub
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-transparent px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text)] transition-all hover:border-[var(--border-hot)] hover:bg-[var(--bg-elev)]"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-[var(--border)] py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        <div>EDITH · 151 checks · updated daily</div>
        <div className="flex items-center gap-4">
          <Link href="/compliance" className="hover:text-[var(--text)]">
            Compliance →
          </Link>
          <Link href="/pricing" className="hover:text-[var(--text)]">
            Pricing →
          </Link>
          <Link href="/" className="hover:text-[var(--text)]">
            ← Back to landing
          </Link>
        </div>
      </div>
    </footer>
  );
}
