"use client";

import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Lock,
  Minus,
  Plug,
  Rocket,
  ScrollText,
  Shield,
  ShieldCheck,
  Sparkles as SparkleIcon,
  Terminal,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { NavBar } from "@/components/edith/nav-bar";
import { PageBackground } from "@/components/edith/page-background";
import { EdithLogo } from "@/components/edith/logo";
import { GithubMark } from "@/components/edith/github-mark";
import { BorderBeam } from "@/components/magicui/border-beam";
import { TypingAnimation } from "@/components/magicui/typing-animation";
import { Meteors } from "@/components/magicui/meteors";
import { Particles } from "@/components/magicui/particles";

import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { MagicCard } from "@/components/spectrum-ui/magic-card";
import { Marquee } from "@/components/spectrum-ui/marquee";
import { Sparkles } from "@/components/spectrum-ui/sparkles";
import { NumberTicker } from "@/components/spectrum-ui/number-ticker";
import { ScrollProgress } from "@/components/spectrum-ui/scroll-progress";

export default function Home() {
  return (
    <>
      <PageBackground />
      <ScrollProgress />
      <NavBar />
      <main className="relative z-10 flex-1 overflow-x-hidden">
        <Hero />
        <ProofBar />
        <Problem />
        <Coverage />
        <Magic />
        <AiAware />
        <Compare />
        <Integrations />
        <Pricing />
        <StackMarquee />
        <Faq />
        <FinalCta />
        <Footer />
      </main>
    </>
  );
}

/* ============================================================
 * HERO
 * ========================================================== */

function Hero() {
  return (
    <section className="relative pt-14">
      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-12 lg:pt-16">
        {/* === COPY === */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            </span>
            Live · 151 deterministic checks
          </div>

          <h1 className="mt-7 text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] text-[var(--text)] sm:text-[64px] lg:text-[76px]">
            From commit to fix
            <br />
            in <span className="text-[var(--accent)]">60 seconds.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[560px] text-[15.5px] leading-[1.6] text-[var(--text-dim)] sm:text-[16.5px]">
            EDITH audits every push for the patterns Cursor, Claude, v0 and
            Lovable get wrong — then hands the fix prompt back to your editor.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <PrimaryCta href="/signin">
              <GithubMark className="h-3.5 w-3.5" /> Connect GitHub
            </PrimaryCta>
            <GhostCta href="#coverage">See what we catch</GhostCta>
          </div>
        </motion.div>

        {/* === LIVE PIPELINE PANEL === */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut", delay: 0.2 }}
          className="mt-12 lg:mt-16"
        >
          <HeroPanel />
        </motion.div>

        {/* === SOCIAL PROOF === */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <span>
            <span className="text-[var(--accent)]">
              <NumberTicker value={2400} />+
            </span>{" "}
            repos scanned
          </span>
          <span className="text-[var(--border-hot)]">·</span>
          <span>
            <span className="text-[var(--text)]">
              <NumberTicker value={62} />
            </span>{" "}
            compliance controls
          </span>
          <span className="text-[var(--border-hot)]">·</span>
          <span>SOC 2 · PCI-DSS · GDPR · Play Store · App Store</span>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * HERO PANEL — single unified live-audit surface
 * One card, three internal columns (Input · EDITH · Output),
 * with animated beams travelling between them and content that
 * updates on a loop so the panel always feels alive.
 * ========================================================== */

function HeroPanel() {
  const [checksRun, setChecksRun] = useState(0);
  const [score, setScore] = useState(100);
  const [issueCount, setIssueCount] = useState(0);
  const [phase, setPhase] = useState<"idle" | "scan" | "fix" | "done">("idle");

  useEffect(() => {
    let cancelled = false;

    const runCycle = async () => {
      if (cancelled) return;
      // Phase: idle
      setPhase("idle");
      setChecksRun(0);
      setScore(100);
      setIssueCount(0);
      await wait(900);

      // Phase: scan — checksRun climbs
      if (cancelled) return;
      setPhase("scan");
      for (let n = 0; n <= 151; n += 6) {
        if (cancelled) return;
        setChecksRun(Math.min(n, 151));
        await wait(28);
      }
      setChecksRun(151);

      // Issues appear one by one — drives both list and score
      const SEV_WEIGHT = [18, 9, 9, 4]; // critical · high · high · medium
      for (let i = 0; i < HERO_ISSUES.length; i++) {
        if (cancelled) return;
        setIssueCount(i + 1);
        setScore((prev) => Math.max(58, prev - SEV_WEIGHT[i]));
        await wait(450);
      }

      // Phase: fix
      if (cancelled) return;
      setPhase("fix");
      await wait(2000);

      // Phase: done
      if (cancelled) return;
      setPhase("done");
      await wait(2400);
    };

    runCycle();
    const interval = setInterval(runCycle, 11000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]">
      {/* Subtle ambient particles, low density */}
      <Particles quantity={10} color="#FFB627" className="opacity-30" />

      {/* === TOPBAR === */}
      <div className="relative flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg)]/80 px-5 py-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-4 w-[2px] bg-[var(--accent)]" />
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--text)]">
            EDITH ▸ live audit
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] sm:inline">
            krova/payments
          </span>
        </div>
        <PhasePill phase={phase} />
      </div>

      {/* === BODY (3 columns, each min-h locked) === */}
      <div className="relative grid gap-px bg-[var(--border)] md:grid-cols-[1fr_1.15fr_1.1fr]">
        {/* ─── INPUT ─── */}
        <div className="relative bg-[var(--bg-elev)] p-5 md:min-h-[400px]">
          <ColTitle step="01" label="Input" />

          <div className="mt-4 space-y-2.5">
            <MetaRow k="Repo" v="krova/payments" />
            <MetaRow k="Branch" v="feat/checkout" />
            <MetaRow k="By" v="@nikhil · 12s ago" />
          </div>

          <div className="mt-5 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="flex items-center gap-2 font-mono text-[10.5px]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              <span className="text-[var(--text)]">a8f3c12</span>
            </div>
            <div className="mt-1.5 truncate font-mono text-[10.5px] text-[var(--text-dim)]">
              wire stripe checkout + delete user
            </div>
            <div className="mt-2.5 flex items-center gap-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <span>
                <span className="text-[var(--success)]">+2,341</span> /{" "}
                <span className="text-[var(--danger)]">−892</span>
              </span>
              <span>28 files</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
            webhook delivered · 87ms
          </div>
        </div>

        {/* ─── EDITH (centre) ─── */}
        <div className="relative bg-[var(--bg)] p-5 md:min-h-[400px]">
          <ColTitle step="02" label="EDITH" highlight />

          <div className="mt-4 grid place-items-center">
            <ScoreRing score={score} />
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <span>Checks running</span>
              <span className="tabular-nums text-[var(--accent)]">
                {checksRun}/151
              </span>
            </div>
            <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150 ease-linear"
                style={{
                  width: `${(checksRun / 151) * 100}%`,
                  boxShadow: "0 0 8px var(--accent-glow)",
                }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-1.5">
            {HERO_CATS.map((cat) => {
              const done = checksRun / 151 >= cat.pct;
              const active = !done && checksRun / 151 >= cat.pct - 0.18;
              return (
                <div
                  key={cat.l}
                  className={`flex items-center justify-center rounded-sm border px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] transition-colors duration-300 ${
                    done
                      ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]"
                      : active
                        ? "border-[var(--border-hot)] bg-[var(--bg-elev)] text-[var(--text)]"
                        : "border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text-muted)]"
                  }`}
                >
                  {cat.l}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── OUTPUT ─── */}
        <div className="relative bg-[var(--bg-elev)] p-5 md:min-h-[400px]">
          <ColTitle step="03" label="Output" />

          {/* All four issue rows are always rendered. Visibility is driven by
              `issueCount` — opacity + translate transitions make them appear
              one by one without any AnimatePresence layout fights. */}
          <div className="mt-4 flex flex-col gap-1.5">
            {HERO_ISSUES.map((it, idx) => {
              const visible = idx < issueCount;
              return (
                <div
                  key={it.id}
                  className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2.5 transition-all duration-300 ease-out"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateX(0)" : "translateX(10px)",
                  }}
                >
                  <span
                    aria-hidden
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-sm ${
                      it.sev === "critical"
                        ? "bg-[var(--danger)]"
                        : it.sev === "high"
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--cool-2)]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] leading-tight text-[var(--text)]">
                      {it.title}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[9.5px] text-[var(--text-muted)]">
                      {it.file}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Copy-fix button — pulses amber when active */}
          <div
            className={`mt-4 flex items-center gap-2 rounded-md border px-3 py-2 transition-colors duration-300 ${
              phase === "fix" || phase === "done"
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--bg)]"
            }`}
          >
            <Copy className="h-3 w-3 text-[var(--accent)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text)]">
              {phase === "done" ? "Copied to clipboard" : "Copy fix prompt"}
            </span>
            {phase === "done" && (
              <Check
                className="ml-auto h-3 w-3 text-[var(--success)]"
                strokeWidth={2.5}
              />
            )}
          </div>
        </div>
      </div>

      {/* === FOOTER === */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg)]/80 px-5 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <Activity className="h-3 w-3" strokeWidth={1.75} />
          p50 60s · p95 240s
        </div>
        <div className="flex items-center gap-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <span>Detected: Cursor · Claude Code</span>
          <span className="h-1 w-1 rounded-full bg-[var(--border-hot)]" />
          <span>edith-bot ready</span>
        </div>
      </div>
    </div>
  );
}

/* Static data for HeroPanel — kept outside the component so identities are
 * stable across re-renders. */
const HERO_ISSUES: Array<{
  id: number;
  sev: "critical" | "high" | "medium";
  title: string;
  file: string;
}> = [
  {
    id: 1,
    sev: "critical",
    title: "Stripe webhook missing signature",
    file: "api/webhooks/stripe.ts:12",
  },
  {
    id: 2,
    sev: "high",
    title: "JWT stored in localStorage",
    file: "(auth)/login.tsx:48",
  },
  {
    id: 3,
    sev: "high",
    title: "Server Action with no auth check",
    file: "actions/delete-user.ts:1",
  },
  {
    id: 4,
    sev: "medium",
    title: "PII in response body",
    file: "api/users/route.ts:24",
  },
];

const HERO_CATS = [
  { l: "SEC", pct: 0.18 },
  { l: "PERF", pct: 0.35 },
  { l: "REL", pct: 0.52 },
  { l: "DATA", pct: 0.68 },
  { l: "BIZ", pct: 0.84 },
  { l: "DEPLOY", pct: 1.0 },
];

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function PhasePill({
  phase,
}: {
  phase: "idle" | "scan" | "fix" | "done";
}) {
  const map = {
    idle: { label: "Idle", color: "var(--text-muted)", pulse: false },
    scan: { label: "Scanning", color: "var(--accent)", pulse: true },
    fix: { label: "Generating fix", color: "var(--accent)", pulse: true },
    done: { label: "Reported", color: "var(--success)", pulse: false },
  } as const;
  const c = map[phase];
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.22em]"
      style={{
        color: c.color,
        borderColor: `color-mix(in srgb, ${c.color} 40%, transparent)`,
        background: `color-mix(in srgb, ${c.color} 8%, transparent)`,
      }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${c.pulse ? "animate-pulse" : ""}`}
        style={{ background: c.color }}
      />
      {c.label}
    </div>
  );
}

function ColTitle({
  step,
  label,
  highlight,
}: {
  step: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        className={`font-mono text-[9px] uppercase tracking-[0.22em] ${
          highlight ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
        }`}
      >
        {step}
      </span>
      <span
        className={`font-mono text-[11px] font-semibold uppercase tracking-[0.22em] ${
          highlight ? "text-[var(--text)]" : "text-[var(--text-dim)]"
        }`}
      >
        {label}
      </span>
      {highlight && (
        <span
          aria-hidden
          className="ml-auto h-3 w-[2px] bg-[var(--accent)]"
        />
      )}
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {k}
      </span>
      <span className="truncate text-[12px] text-[var(--text)]">{v}</span>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const SIZE = 144;
  const STROKE = 5;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * RADIUS;
  const offset = CIRC - (score / 100) * CIRC;
  const tone =
    score >= 75
      ? "var(--success)"
      : score >= 50
        ? "var(--accent)"
        : "var(--danger)";
  return (
    <div className="relative">
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="var(--border)"
          strokeWidth={STROKE}
          fill="transparent"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={tone}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          fill="transparent"
          style={{
            transition: "stroke-dashoffset 350ms ease, stroke 350ms ease",
            filter: `drop-shadow(0 0 8px ${tone})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          Score
        </div>
        <div
          className="mt-0.5 font-mono text-[40px] font-semibold tabular-nums leading-none"
          style={{ color: tone, letterSpacing: "-0.03em" }}
        >
          {Math.round(score)}
        </div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          / 100
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * PROOF BAR — animated counters
 * ========================================================== */

function ProofBar() {
  const stats: { value: number; suffix?: string; label: string }[] = [
    { value: 151, label: "Deterministic checks" },
    { value: 5, label: "Compliance frameworks" },
    { value: 62, label: "Mapped controls" },
    { value: 60, suffix: "s", label: "Avg scan time" },
  ];
  return (
    <section className="relative border-y border-[var(--border)] bg-[var(--bg-elev)]/60">
      <Particles
        quantity={20}
        color="#FFB627"
        className="opacity-40"
      />
      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-12 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="relative pl-5">
            <span
              aria-hidden
              className="absolute left-0 top-1 h-4 w-[2px] bg-[var(--accent)]"
            />
            <div className="font-mono text-[40px] font-semibold leading-none tabular-nums text-[var(--text)]">
              <NumberTicker
                value={s.value}
                duration={1800}
                suffix={s.suffix ?? ""}
              />
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
 * PROBLEM — why EDITH exists
 * ========================================================== */

function Problem() {
  const cards = [
    {
      icon: Bot,
      title: "AI agents hallucinate dependencies",
      body: "Cursor invents npm packages that don't exist. The build passes locally, breaks in CI, and AI agents try to fix it by inventing more.",
      stat: "31%",
      statLabel: "of AI repos",
    },
    {
      icon: Lock,
      title: "Secrets leak into client bundles",
      body: "Stripe, Razorpay, OpenAI keys end up in NEXT_PUBLIC_ vars. Anyone can drain your account from DevTools.",
      stat: "1 in 6",
      statLabel: "repos audited",
    },
    {
      icon: ShieldCheck,
      title: "Auth is missing on POST routes",
      body: "Server Actions and route handlers ship without auth checks. AI prefers what's tutorial-shaped over what's safe.",
      stat: "62%",
      statLabel: "of new routes",
    },
  ];

  return (
    <Section
      eyebrow="The Problem"
      title="AI doesn't know what it doesn't know."
      sub="Every line your AI agent writes was trained on tutorial code. Tutorial code doesn't include auth, doesn't validate input, doesn't ship to production. Your app does."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.08}>
            <SpotlightCard className="h-full p-7">
              <c.icon
                className="h-5 w-5 text-[var(--accent)]"
                strokeWidth={1.5}
              />
              <h3 className="mt-5 text-[17px] font-semibold leading-tight tracking-tight text-[var(--text)]">
                {c.title}
              </h3>
              <p className="mt-3 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
                {c.body}
              </p>
              <div className="mt-6 flex items-end justify-between border-t border-[var(--border)] pt-4">
                <div>
                  <div className="font-mono text-[28px] font-semibold leading-none tabular-nums text-[var(--accent)]">
                    {c.stat}
                  </div>
                  <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {c.statLabel}
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  EDITH scan data
                </span>
              </div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
 * FLOW DIAGRAM — AnimatedBeam connecting Github → EDITH → Cursor
 * ========================================================== */

/* ============================================================
 * COVERAGE — 6 dimensions, MagicCard for each
 * ========================================================== */

function Coverage() {
  const dims: {
    icon: LucideIcon;
    name: string;
    blurb: string;
    examples: string[];
  }[] = [
    {
      icon: Shield,
      name: "Security",
      blurb: "OWASP-grade scan tuned for AI-generated code.",
      examples: [
        "Stripe / Razorpay keys in client bundles",
        "Server Actions with no auth check",
        "JWT in localStorage",
        "OAuth callback missing state check",
      ],
    },
    {
      icon: Zap,
      name: "Performance",
      blurb: "LLM cost-leaks, N+1 queries, layout shifts.",
      examples: [
        "Embedding call with no cache",
        "useEffect with inline-object deps",
        "<Image> without width / height",
        "Await inside DB loop",
      ],
    },
    {
      icon: Activity,
      name: "Reliability",
      blurb: "AI-pattern silent-catches and stale closures.",
      examples: [
        "Silent catch blocks",
        "useEffect stale closure",
        "Floating promise",
        "Next 15 cookies() not awaited",
      ],
    },
    {
      icon: Database,
      name: "Data Safety",
      blurb: "RLS, PII leakage, schema invariants.",
      examples: [
        "Tables without RLS",
        "Plain 'password' column",
        "PII in response body",
        "Multi-table writes without transaction",
      ],
    },
    {
      icon: GitBranch,
      name: "Business Logic",
      blurb: "Race conditions, missing idempotency.",
      examples: [
        "Webhook with no dedup",
        "Currency from client",
        "Admin route w/o role check",
        "Tool dispatcher with no allowlist",
      ],
    },
    {
      icon: Rocket,
      name: "Deploy Ready",
      blurb: "What breaks the first prod push.",
      examples: [
        "process.env.X in client component",
        "output:'export' with route handlers",
        "No engines.node pin",
        "Missing lockfile",
      ],
    },
  ];

  return (
    <Section
      id="coverage"
      eyebrow="Coverage"
      title="Six dimensions. One hundred and fifty-one checks."
      sub="Every check is deterministic — same input, same finding, every time. No LLM tax on your scan. We name the file, the line, and the exact pattern that broke."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dims.map((d, i) => (
          <Reveal key={d.name} delay={(i % 3) * 0.06}>
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
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
 * MAGIC MOMENT — PR comment + fix-prompt
 * ========================================================== */

function Magic() {
  return (
    <Section
      eyebrow="The Magic Moment"
      title="From issue to merged in two clicks."
      sub="EDITH writes the fix prompt for you. Paste it into Cursor / Claude / Copilot. Review. Merge. The whole loop is under 60 seconds."
    >
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <Reveal>
          <MagicCard className="h-full overflow-hidden p-6">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] font-mono text-[10px] font-bold text-[var(--bg)]">
                ED
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[12px] text-[var(--text)]">
                  edith-bot{" "}
                  <span className="text-[var(--text-dim)]">
                    commented on PR #1284
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                  payments/checkout · 3 minutes ago
                </div>
              </div>
              <div className="ml-auto rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-[var(--accent)]">
                78 / 100
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              <IssueRow
                sev="critical"
                text="Stripe webhook missing signature verification"
                file="app/api/webhooks/stripe/route.ts:12"
              />
              <IssueRow
                sev="critical"
                text="Order table missing RLS policy"
                file="supabase/migrations/0003_orders.sql:24"
              />
              <IssueRow
                sev="high"
                text="JWT stored in localStorage"
                file="app/(auth)/login.tsx:48"
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110">
                <Copy className="h-3 w-3" /> Copy fix prompt
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text)] transition-all hover:border-[var(--border-hot)]">
                View full report <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </MagicCard>
        </Reveal>

        <Reveal delay={0.08}>
          <MagicCard className="h-full overflow-hidden p-0">
            <div className="flex h-9 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elev-2)] px-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)]/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)]/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)]/60" />
              </div>
              <div className="flex items-center gap-1.5 rounded-md bg-[var(--bg)] px-3 py-1">
                <Terminal className="h-3 w-3 text-[var(--accent)]" />
                <span className="font-mono text-[11px] text-[var(--text)]">
                  EDITH ▸ fix-prompt.md
                </span>
              </div>
            </div>
            <pre className="overflow-auto bg-[var(--bg)] p-5 font-mono text-[12px] leading-[1.7] text-[var(--text-dim)]">
              <code>
                <TypingAnimation
                  duration={6}
                  text={`# Stripe webhook signature verification

EDITH found 2 critical issues on this PR.

## Files to change
- app/api/webhooks/stripe/route.ts:12

## Pattern
The handler reads req.json() directly and trusts
the body. An attacker can fake events.

## Fix
Use stripe.webhooks.constructEvent() with the
stripe-signature header and STRIPE_WEBHOOK_SECRET.
Reject anything that fails verification.

## Acceptance
- A request without a valid signature returns 400
- The handler runs on the verified event object
- Add an idempotency check before applying side
  effects`}
                />
              </code>
            </pre>
          </MagicCard>
        </Reveal>
      </div>
      <p className="mt-8 text-center text-[14px] text-[var(--text-dim)]">
        EDITH writes the prompt. You paste. Cursor fixes.
      </p>
    </Section>
  );
}

function IssueRow({
  sev,
  text,
  file,
}: {
  sev: "critical" | "high" | "medium";
  text: string;
  file: string;
}) {
  const dot =
    sev === "critical"
      ? "bg-[var(--danger)]"
      : sev === "high"
        ? "bg-[var(--accent)]"
        : "bg-[var(--cool-2)]";
  return (
    <div className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 transition-colors hover:border-[var(--border-hot)]">
      <span aria-hidden className={`mt-1 h-2 w-2 shrink-0 rounded-sm ${dot}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-[var(--text)]">{text}</div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-muted)]">
          {file}
        </div>
      </div>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {sev}
      </span>
    </div>
  );
}

/* ============================================================
 * AI-AWARE — live-detection panel cycling each tool's signature flaw
 * ========================================================== */

type AiSignature = {
  label: string;
  color: string;
  file: string;
  pattern: string;
  flag: string;
};

const AI_SIGNATURES: AiSignature[] = [
  {
    label: "Cursor",
    color: "#34D399",
    file: "app/api/feed/route.ts",
    pattern: `import { parseCSV } from "csv-parser-mini"`,
    flag: "Hallucinated package · 0 npm downloads",
  },
  {
    label: "v0",
    color: "#F472B6",
    file: "components/user-card.tsx",
    pattern: `<Image src={user.avatar} />`,
    flag: "Missing alt attribute · 7 instances",
  },
  {
    label: "Lovable",
    color: "#FB923C",
    file: "app/dashboard/page.tsx",
    pattern: `await supabase.from("users").select("*")`,
    flag: "No RLS policy on public table",
  },
  {
    label: "Claude",
    color: "#FFB627",
    file: "lib/auth/session.ts",
    pattern: `try { /* … */ } catch { /* swallowed */ }`,
    flag: "Silent catch · 4 instances",
  },
  {
    label: "Bolt",
    color: "#60A5FA",
    file: "lib/openai.ts",
    pattern: `const key = process.env.OPENAI_KEY`,
    flag: "Secret reachable from client bundle",
  },
  {
    label: "Windsurf",
    color: "#22D3EE",
    file: "app/api/llm/route.ts",
    pattern: `model: "gpt-4", messages`,
    flag: "Cost-leak · no max_tokens cap",
  },
  {
    label: "Codex",
    color: "#6BAED6",
    file: "proxy.ts",
    pattern: `if (req.cookies.get("token")) next()`,
    flag: "Auth check without verification",
  },
  {
    label: "Copilot",
    color: "#A78BFA",
    file: "app/products/[id]/page.tsx",
    pattern: `const data = await fetch(url)`,
    flag: "No revalidation strategy",
  },
];

function AiAware() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % AI_SIGNATURES.length),
      2400,
    );
    return () => clearInterval(t);
  }, []);

  const active = AI_SIGNATURES[idx]!;
  const ts = mockTimestamp(idx);

  return (
    <Section
      eyebrow="AI-aware"
      title="Built for the way AI writes code."
      sub="EDITH detects which AI tool generated the code in your repo, then runs the rules that catch each tool's signature failure modes. Cursor hallucinates packages. v0 ships missing alt attributes. Lovable forgets RLS. EDITH knows."
    >
      <div className="relative mx-auto w-full max-w-3xl">
        {/* Live-detection terminal */}
        <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]/85 shadow-[0_0_60px_-30px_var(--accent-glow)]">
          <span
            aria-hidden
            className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
          />
          {/* terminal chrome */}
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)]/80 bg-[var(--bg)]/40 px-5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]/40" />
              <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]/40" />
              <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]/40" />
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                edith · live detection
              </span>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                style={{ boxShadow: "0 0 8px var(--accent-glow)" }}
              />
              scanning
            </span>
          </div>

          {/* live readout */}
          <div className="px-5 py-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="space-y-2.5 font-mono text-[12px] leading-[1.6]"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--text-muted)]">
                  <span className="text-[var(--text-dim)]">[{ts}]</span>
                  <span>detected:</span>
                  <span
                    className="font-semibold uppercase tracking-[0.12em]"
                    style={{ color: active.color }}
                  >
                    {active.label}
                  </span>
                  <span className="text-[var(--text-dim)]">in</span>
                  <span className="text-[var(--text)]">{active.file}</span>
                </div>
                <div className="rounded-md border border-[var(--border)]/70 bg-[var(--bg)]/55 px-3 py-2 text-[11.5px] text-[var(--text)]">
                  <span className="select-none text-[var(--text-muted)]">
                    {"> "}
                  </span>
                  {active.pattern}
                </div>
                <div className="flex items-start gap-2 text-[11.5px]">
                  <span className="mt-[3px] inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  <span className="text-[var(--accent)]">flag:</span>
                  <span className="text-[var(--text)]">{active.flag}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* grid of tools — active one lit */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {AI_SIGNATURES.map((s, i) => {
            const isActive = i === idx;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Show ${s.label} detection`}
                aria-pressed={isActive}
                className={`group relative flex items-center gap-2 overflow-hidden rounded-md border px-3 py-2.5 text-left transition-all duration-300 ${
                  isActive
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_30px_-12px_var(--accent-glow)]"
                    : "border-[var(--border)] bg-[var(--bg-elev)]/55 hover:border-[var(--border-hot)]"
                }`}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full transition-transform duration-300"
                  style={{
                    background: s.color,
                    boxShadow: isActive ? `0 0 10px ${s.color}` : "none",
                    transform: isActive ? "scale(1.15)" : "scale(1)",
                  }}
                />
                <span
                  className={`truncate font-mono text-[10.5px] uppercase tracking-[0.15em] transition-colors ${
                    isActive ? "text-[var(--text)]" : "text-[var(--text-dim)] group-hover:text-[var(--text)]"
                  }`}
                >
                  {s.label}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="aiaware-active-bar"
                    aria-hidden
                    className="absolute bottom-0 left-0 h-[2px] bg-[var(--accent)]"
                    initial={false}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2.4, ease: "linear" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function mockTimestamp(i: number): string {
  // Stable, plausible-looking timestamps that step forward as we cycle.
  const base = 12 * 3600 + 43 * 60 + 17;
  const s = (base + i * 7) % (24 * 3600);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/* ============================================================
 * COMPARE
 * ========================================================== */

function Compare() {
  const rows: {
    feat: string;
    edith: boolean | "partial";
    coderabbit: boolean | "partial";
    sentry: boolean | "partial";
    snyk: boolean | "partial";
    lighthouse: boolean | "partial";
  }[] = [
    {
      feat: "Security scanning",
      edith: true,
      coderabbit: true,
      sentry: false,
      snyk: true,
      lighthouse: false,
    },
    {
      feat: "Compliance mapping (PCI-DSS / SOC 2 / GDPR)",
      edith: true,
      coderabbit: false,
      sentry: false,
      snyk: "partial",
      lighthouse: false,
    },
    {
      feat: "AI-pattern detection (hallucinated imports, silent catches)",
      edith: true,
      coderabbit: false,
      sentry: false,
      snyk: false,
      lighthouse: false,
    },
    {
      feat: "LLM-app cost-leak detection",
      edith: true,
      coderabbit: false,
      sentry: false,
      snyk: false,
      lighthouse: false,
    },
    {
      feat: "Live browser auditing (DevTools panel)",
      edith: true,
      coderabbit: false,
      sentry: "partial",
      snyk: false,
      lighthouse: true,
    },
    {
      feat: "Fix prompts for Cursor / Claude / Copilot",
      edith: true,
      coderabbit: false,
      sentry: false,
      snyk: false,
      lighthouse: false,
    },
    {
      feat: "Single unified score",
      edith: true,
      coderabbit: false,
      sentry: false,
      snyk: false,
      lighthouse: true,
    },
  ];
  return (
    <Section
      id="compliance"
      eyebrow="vs. the field"
      title="The only tool built for AI-built apps."
      sub="Sentry tells you what broke. Snyk finds CVEs in node_modules. Lighthouse grades performance. None of them know your app was written by Cursor at 2am."
    >
      <Reveal>
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)] font-mono text-[10px] uppercase tracking-[0.15em]">
                  <th className="px-5 py-4 text-[var(--text-dim)]">Feature</th>
                  <th className="border-l border-[var(--accent)]/40 bg-[var(--accent-soft)] px-5 py-4 text-[var(--accent)]">
                    EDITH
                  </th>
                  <th className="px-5 py-4 text-[var(--text-dim)]">CodeRabbit</th>
                  <th className="px-5 py-4 text-[var(--text-dim)]">Sentry</th>
                  <th className="px-5 py-4 text-[var(--text-dim)]">Snyk</th>
                  <th className="px-5 py-4 text-[var(--text-dim)]">Lighthouse</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.feat}
                    className="border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-elev-2)]/50"
                  >
                    <td className="px-5 py-3.5 text-[13.5px] text-[var(--text)]">
                      {r.feat}
                    </td>
                    <td className="border-l border-[var(--accent)]/40 bg-[var(--accent-soft)] px-5 py-3.5">
                      <Mark v={r.edith} accent />
                    </td>
                    <td className="px-5 py-3.5">
                      <Mark v={r.coderabbit} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Mark v={r.sentry} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Mark v={r.snyk} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Mark v={r.lighthouse} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

function Mark({ v, accent }: { v: boolean | "partial"; accent?: boolean }) {
  if (v === "partial")
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-dim)]">
        Partial
      </span>
    );
  if (v === true)
    return (
      <Check
        className={`h-4 w-4 ${accent ? "text-[var(--accent)]" : "text-[var(--cool-1)]"}`}
        strokeWidth={2.5}
      />
    );
  return <Minus className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={2} />;
}

/* ============================================================
 * PRICING
 * ========================================================== */

function Pricing() {
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const tiers = [
    {
      name: "Free",
      inr: "₹0",
      usd: "$0",
      desc: "For weekend projects.",
      features: ["1 repo", "Weekly scans", "Basic report", "Browser extension"],
      cta: "Start free",
      featured: false,
    },
    {
      name: "Builder",
      inr: "₹499",
      usd: "$9",
      desc: "For indie devs shipping fast.",
      features: [
        "5 repos",
        "Daily scans",
        "Fix prompts",
        "PR integration",
        "DevTools panel",
      ],
      cta: "Start Builder",
      featured: false,
    },
    {
      name: "Pro",
      inr: "₹1,499",
      usd: "$29",
      desc: "For teams that ship every day.",
      features: [
        "Unlimited repos",
        "Real-time scans",
        "All integrations",
        "Slack alerts",
        "Compliance reports",
      ],
      cta: "Start Pro",
      featured: true,
    },
    {
      name: "Agency",
      inr: "₹3,999",
      usd: "$79",
      desc: "For studios with client work.",
      features: [
        "Client workspaces",
        "White-label reports",
        "Dedicated reviewer",
        "Priority support",
        "Auditor PDF reports",
      ],
      cta: "Talk to us",
      featured: false,
    },
  ];
  return (
    <Section
      eyebrow="Pricing"
      title="Pay for what your team ships."
      sub="14-day Pro trial. Billing in INR via PayU or USD. Cancel anytime — we don't lock anyone in."
    >
      <div className="mb-7 flex justify-end">
        <div className="inline-flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--bg-elev)] p-0.5 font-mono text-[10px] uppercase tracking-[0.15em]">
          {(["INR", "USD"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`h-7 rounded-full px-3 transition-colors ${
                currency === c
                  ? "bg-[var(--accent)] text-[var(--bg)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t, i) => {
          const price = currency === "INR" ? t.inr : t.usd;
          if (t.featured) {
            return (
              <Reveal key={t.name} delay={i * 0.05}>
                <MagicCard
                  className="relative h-full p-7"
                  gradientColor="rgba(255, 182, 39, 0.55)"
                  gradientSize={300}
                >
                  <span className="absolute -top-3 right-5 rounded-full bg-[var(--accent)] px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)]">
                    Most popular
                  </span>
                  <PricingBody t={t} price={price} featured />
                  <BorderBeam size={160} duration={9} />
                </MagicCard>
              </Reveal>
            );
          }
          return (
            <Reveal key={t.name} delay={i * 0.05}>
              <SpotlightCard className="h-full p-7">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
                />
                <PricingBody t={t} price={price} />
              </SpotlightCard>
            </Reveal>
          );
        })}
      </div>
      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Billing in INR via PayU · Cancel anytime · 14-day Pro trial
      </p>
    </Section>
  );
}

function PricingBody({
  t,
  price,
  featured,
}: {
  t: {
    name: string;
    desc: string;
    features: string[];
    cta: string;
  };
  price: string;
  featured?: boolean;
}) {
  return (
    <>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
        {t.name}
      </h3>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono text-[32px] font-semibold tabular-nums text-[var(--text)]">
          {price}
        </span>
        <span className="font-mono text-xs text-[var(--text-dim)]">/mo</span>
      </div>
      <p className="mt-4 text-[13px] leading-[1.55] text-[var(--text-dim)]">
        {t.desc}
      </p>
      <ul className="mt-5 space-y-2.5">
        {t.features.map((f) => (
          <li
            key={f}
            className="flex items-center gap-2 text-[13px] text-[var(--text)]"
          >
            <Check
              className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
              strokeWidth={2.5}
            />
            {f}
          </li>
        ))}
      </ul>
      <button
        className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] transition-all ${
          featured
            ? "bg-[var(--accent)] text-[var(--bg)] hover:brightness-110"
            : "border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-hot)] hover:bg-[var(--bg-elev-2)]"
        }`}
      >
        {t.cta} <ArrowRight className="h-3 w-3" />
      </button>
    </>
  );
}

/* ============================================================
 * STACK — infinite marquee
 * ========================================================== */

function StackMarquee() {
  const stacks = [
    "Next.js",
    "Supabase",
    "Stripe",
    "Razorpay",
    "Clerk",
    "Vercel",
    "PlanetScale",
    "Drizzle",
    "Prisma",
    "Anthropic",
    "OpenAI",
    "Inngest",
    "Resend",
    "Upstash",
    "PostgreSQL",
    "PayU",
  ];
  return (
    <section className="relative border-y border-[var(--border)] py-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Built for your stack
        </div>
      </div>
      <div className="relative mt-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-[var(--bg)] to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-[var(--bg)] to-transparent"
        />
        <Marquee duration={42} gap="gap-12">
          {stacks.map((s) => (
            <span
              key={s}
              className="font-mono text-[14px] uppercase tracking-[0.18em] text-[var(--cool-1)] hover:text-[var(--accent)]"
            >
              {s}
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

/* ============================================================
 * FAQ
 * ========================================================== */

function Faq() {
  const items = [
    {
      q: "How is EDITH different from Sentry, Snyk, or CodeRabbit?",
      a: "Sentry tells you when something broke in production. Snyk scans your dependencies for known CVEs. CodeRabbit summarises PRs. EDITH is the only auditor built for the specific failure modes AI agents produce — hallucinated imports, prompt injection, secrets in client bundles, missing auth on Server Actions, LLM cost-leaks. We detect which AI wrote each file and run rules tuned to that tool.",
    },
    {
      q: "What does EDITH access in my repo?",
      a: "Read-only via GitHub App. We never write to your repo or open PRs you didn't approve. We see source files (not your secrets), CI configs, and webhook events. You can revoke access in one click.",
    },
    {
      q: "How long does a scan take?",
      a: "60 seconds median, 4 minutes p95 for repos under 400 files. We deliberately cap repo size so scans stay fast — anything over fires a warning. Larger orgs use Inngest workers for parallel batches.",
    },
    {
      q: "Will EDITH share my code with an LLM?",
      a: "151 of the 151 deterministic checks run without ever calling an LLM. We use Claude only for fix-prompt summarisation and only for issues you explicitly open — never to scan your code, never to train on it.",
    },
    {
      q: "Can I export findings for SOC 2 / PCI audit evidence?",
      a: "Yes. Pro and Agency plans generate auditor-ready PDFs that map every EDITH finding to PCI-DSS, SOC 2, GDPR, Play Store and Apple App Store controls. 62 compliance controls mapped today, with the framework set growing.",
    },
    {
      q: "Is EDITH self-hostable?",
      a: "Not yet — we're focused on the hosted product first. The scanner core is open-source, but the dashboard, billing, and integrations are not. Talk to us if you're an enterprise needing on-prem.",
    },
  ];
  return (
    <Section
      eyebrow="Questions"
      title="Things people ask us."
    >
      <div className="mx-auto max-w-3xl divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]">
        {items.map((item, i) => (
          <FaqRow key={i} q={item.q} a={item.a} />
        ))}
      </div>
    </Section>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[var(--bg-elev-2)]/50"
      >
        <span className="text-[14.5px] font-medium text-[var(--text)]">
          {q}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-[13.5px] leading-[1.65] text-[var(--text-dim)]">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
 * FINAL CTA
 * ========================================================== */

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-y border-[var(--border)] bg-[var(--bg-elev)]/60">
      <Meteors number={14} />
      <Sparkles count={20} />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255, 182, 39, 0.12), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
          <SparkleIcon className="h-3 w-3" />
          14-day Pro trial · no card needed
        </div>
        <h2 className="mt-6 text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--text)] sm:text-[52px]">
          Stop shipping <span className="text-[var(--accent)]">AI bugs</span> by
          accident.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.6] text-[var(--text-dim)]">
          Connect your GitHub. EDITH scans your last commit in 60 seconds.
          You'll know in one screen whether your AI agent shipped something
          dangerous.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <PrimaryCta href="/signin">
            <GithubMark className="h-3.5 w-3.5" /> Connect GitHub
          </PrimaryCta>
          <GhostCta href="/pricing">View pricing</GhostCta>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * FOOTER
 * ========================================================== */

function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <EdithLogo />
            <p className="mt-4 max-w-xs text-[13px] leading-[1.6] text-[var(--text-dim)]">
              Every Deploy Inspected. Thoroughly. Honestly. The auditor
              built for AI-generated code.
            </p>
            <div className="mt-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <Plug className="h-3 w-3" /> Made in India · Built with intent
            </div>
          </div>
          <FooterCol
            title="Product"
            items={[
              ["Pricing", "/pricing"],
              ["Changelog", "/changelog"],
              ["Docs", "/docs"],
              ["Status", "/status"],
            ]}
          />
          <FooterCol
            title="Resources"
            items={[
              ["Blog", "/blog"],
              ["Open source", "/oss"],
              ["Security", "/security"],
              ["Compare", "/compare"],
            ]}
          />
          <FooterCol
            title="Company"
            items={[
              ["About", "/about"],
              ["Customers", "/customers"],
              ["Privacy", "/legal/privacy"],
              ["Terms", "/legal/tos"],
            ]}
          />
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <span>© 2026 EDITH Labs</span>
          <div className="flex items-center gap-5">
            <Link href="/legal/privacy" className="hover:text-[var(--text)]">
              Privacy
            </Link>
            <Link href="/legal/tos" className="hover:text-[var(--text)]">
              Terms
            </Link>
            <a
              href="mailto:support@edith.expert"
              className="hover:text-[var(--text)]"
            >
              Contact
            </a>
            <span>v1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
 * INTEGRATIONS — data-handling disclosure
 *
 * This section exists primarily for Google OAuth Trust & Safety review:
 *   - Names each third-party service EDITH integrates with
 *   - States the exact OAuth scope or permission EDITH requests
 *   - Explains the specific user-facing purpose for that data
 *   - Links to /legal/privacy (matches the OAuth consent screen URL)
 *
 * It's also useful for users — the same disclosure that satisfies a
 * reviewer also builds trust with prospects who are about to install a
 * GitHub App or grant Google access.
 * ========================================================== */

function Integrations() {
  return (
    <section id="integrations" className="relative py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            <Lock className="h-3 w-3" strokeWidth={1.75} />
            Integrations &amp; data handling
          </div>
          <h2 className="mt-7 text-[36px] font-semibold leading-[1.05] tracking-[-0.025em] text-[var(--text)] sm:text-[44px]">
            What EDITH reads — and why.
          </h2>
          <p className="mx-auto mt-5 max-w-[600px] text-[14.5px] leading-[1.6] text-[var(--text-dim)]">
            EDITH connects to a few external services to do its job. Below is
            exactly what we ask for from each, and the user-facing purpose for
            it. Full detail lives in the{" "}
            <Link
              href="/legal/privacy"
              className="text-[var(--accent)] hover:brightness-110"
            >
              privacy policy
            </Link>
            .
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          <IntegrationCard
            icon={GithubMark}
            iconKind="component"
            title="GitHub"
            scope="GitHub App · contents:read, pull_requests:write, metadata:read"
            purpose="Fetches source from repositories you explicitly install EDITH on, posts inline review comments + status checks on your pull requests. We never persist your full source — only short snippets (1-3 lines) attached to each finding for context."
            optional={false}
          />
          <IntegrationCard
            icon={Globe}
            iconKind="lucide"
            title="Google Search Console"
            scope="OAuth scope · webmasters.readonly (read-only)"
            purpose="Pulls aggregated search-analytics data — impressions, clicks, CTR, average position per page and query — only for properties you explicitly bind to EDITH. We cross-reference it with on-page SEO findings so 'this page ranks #14 with a weak description' becomes one actionable card. We never modify your Search Console settings or share your data with third parties. You can revoke access at any time from your Google Account."
            optional
          />
          <IntegrationCard
            icon={Bot}
            iconKind="lucide"
            title="Anthropic Claude"
            scope="API · model invocation only"
            purpose="Generates natural-language fix prompts from EDITH's findings, and (with your opt-in) queries Claude with web-search to record how LLMs answer questions about your brand. We send only the issue context — never your full codebase — and our integration disables training on customer data."
            optional={false}
          />
          <IntegrationCard
            icon={Activity}
            iconKind="lucide"
            title="EDITH Browser Extension"
            scope="Chrome extension · activeTab, scripting"
            purpose="Captures Core Web Vitals, the rendered HTML head, and console errors for pages you actively scan. Never reads form inputs, cookies, or local storage from the pages you visit. Sends data to your EDITH account only — never to third parties."
            optional
          />
          <IntegrationCard
            icon={Database}
            iconKind="lucide"
            title="Supabase &amp; Vercel"
            scope="Infrastructure"
            purpose="Hosts the EDITH dashboard, API routes, background workers, and the database that stores your scan history, scores, and findings. All traffic is TLS-encrypted; the database is encrypted at rest; row-level-security policies restrict every sensitive table to its owning organization."
            optional={false}
          />
          <IntegrationCard
            icon={Zap}
            iconKind="lucide"
            title="PayU"
            scope="Payment processor"
            purpose="Used only if you upgrade to a paid plan. PayU handles card details directly; EDITH stores only a customer reference, plan tier, and invoice metadata. We never see or store full card numbers, CVVs, or banking credentials."
            optional
          />
        </div>

        <div className="mx-auto mt-12 max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]/55 p-5 text-center">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
            Our commitments
          </div>
          <p className="mt-3 text-[13px] leading-[1.55] text-[var(--text-dim)]">
            We don&apos;t use your source code or your data to train
            machine-learning models. We don&apos;t sell or share customer
            data with advertisers. We delete repository contents fetched
            for scans within minutes of the scan finishing. You can
            revoke any OAuth grant or delete your account at any time.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/legal/privacy"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)]"
            >
              Privacy policy
            </Link>
            <Link
              href="/legal/tos"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)]"
            >
              Terms of service
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function IntegrationCard({
  icon: Icon,
  iconKind,
  title,
  scope,
  purpose,
  optional,
}: {
  icon: LucideIcon | typeof GithubMark;
  iconKind: "lucide" | "component";
  title: string;
  scope: string;
  purpose: string;
  optional: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]/55 p-5">
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)]">
          {iconKind === "lucide" ? (
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[14.5px] font-semibold text-[var(--text)]">
              {title}
            </h3>
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] ${
                optional
                  ? "border-[var(--border)] bg-[var(--bg-elev-2)] text-[var(--text-muted)]"
                  : "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]"
              }`}
            >
              {optional ? "Optional" : "Required"}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-muted)]">
            {scope}
          </div>
        </div>
      </div>
      <p className="mt-3.5 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
        {purpose}
      </p>
    </div>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: [string, string][];
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {title}
      </div>
      <ul className="mt-4 space-y-2.5">
        {items.map(([label, href]) => (
          <li key={label}>
            <Link
              href={href}
              className="text-[13px] text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
 * SECTION + REVEAL HELPERS
 * ========================================================== */

function Section({
  id,
  title,
  eyebrow,
  sub,
  children,
}: {
  id?: string;
  title: string;
  eyebrow: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="relative">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        <Reveal>
          <div className="mb-10 max-w-2xl">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
              {eyebrow}
            </div>
            <h2 className="mt-3 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--text)] sm:text-[40px]">
              {title}
            </h2>
            {sub && (
              <p className="mt-4 max-w-xl text-[15px] leading-[1.65] text-[var(--text-dim)]">
                {sub}
              </p>
            )}
          </div>
        </Reveal>
        {children}
      </div>
    </section>
  );
}

function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

function PrimaryCta({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110"
    >
      {children} <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function GhostCta({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-transparent px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text)] transition-all hover:border-[var(--border-hot)] hover:bg-[var(--bg-elev)]"
    >
      {children}
    </Link>
  );
}

/* Tree-shake suppressors for icons referenced indirectly */
void FileText;
void Globe;
void ScrollText;
