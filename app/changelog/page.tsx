"use client";
import {
  ArrowRight,
  Bot,
  Check,
  Database,
  FileText,
  GitBranch,
  Globe,
  Plug,
  Shield,
  ShieldCheck,
  Sparkles as SparkleIcon,
  Terminal,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

import { NavBar } from "@/components/edith/nav-bar";
import { PageBackground } from "@/components/edith/page-background";
import { MagicCard } from "@/components/spectrum-ui/magic-card";

type ChangeKind = "feature" | "improvement" | "fix" | "security";

type Change = {
  kind: ChangeKind;
  text: string;
};

type Release = {
  version: string;
  date: string;
  title: string;
  highlight?: string;
  icon: LucideIcon;
  badge?: string;
  changes: Change[];
};

const RELEASES: Release[] = [
  {
    version: "v1.0.0",
    date: "2026-05-23",
    title: "v1.0 — Public launch",
    highlight: "151 deterministic checks · 5 compliance frameworks · DevTools panel.",
    icon: SparkleIcon,
    badge: "Public launch",
    changes: [
      {
        kind: "feature",
        text: "Added v4 check pack — 76 new deterministic checks targeting AI-agent footguns (LLM cost-leaks, React 19 patterns, auth flows, file uploads, accessibility).",
      },
      {
        kind: "feature",
        text: "Compliance now covers PCI-DSS 4.0, SOC 2 CC, GDPR, Google Play Store, Apple App Store — 62 controls, 295+ check↔control mappings.",
      },
      {
        kind: "feature",
        text: "DevTools panel — live Network + Console capture inside Chrome DevTools, with EDITH findings annotated inline per request.",
      },
      {
        kind: "feature",
        text: "AI-tool fingerprinting — detects Cursor, Claude Code, v0, Lovable, Bolt, Windsurf, Replit per file and runs tool-specific rules.",
      },
      {
        kind: "improvement",
        text: "Reworked the landing experience with the live-audit pipeline preview, animated coverage grid, and AI-aware orbital section.",
      },
    ],
  },
  {
    version: "v0.6.0",
    date: "2026-05-19",
    title: "Browser extension v0.6",
    icon: Globe,
    changes: [
      {
        kind: "feature",
        text: "Chrome extension rebuilt with React + Vite + MagicUI. Live page audit, score pill, history drawer, account sync.",
      },
      {
        kind: "feature",
        text: "DevTools panel registered as a peer tab next to Console / Network — full request/response capture and live PII detection.",
      },
      {
        kind: "improvement",
        text: "Cookie + header inspection now reports CSP, HSTS, SameSite, Secure, HttpOnly inline with severity.",
      },
      {
        kind: "fix",
        text: "Patched the React 19 hydration warning caused by motion's useMotionValue in the popup hero.",
      },
    ],
  },
  {
    version: "v0.5.0",
    date: "2026-05-12",
    title: "Custom rules + MCP server",
    icon: Plug,
    changes: [
      {
        kind: "feature",
        text: "edith.config.json — define project-specific checks via regex, AST predicates, or LLM-backed prompts.",
      },
      {
        kind: "feature",
        text: "MCP server at /api/mcp — Claude Code / Cursor / Windsurf can call EDITH tools (run-scan, get-issues, get-score) over JSON-RPC.",
      },
      {
        kind: "improvement",
        text: "PR comment now collapses by severity and includes a 'Copy fix prompt' button per finding.",
      },
    ],
  },
  {
    version: "v0.4.0",
    date: "2026-05-05",
    title: "v3 deep checks + compliance v2",
    icon: ShieldCheck,
    changes: [
      {
        kind: "feature",
        text: "Added 20 v3 deep checks — SSRF, prototype pollution, JWT none algorithm, ReDoS, hallucinated imports, env-var typo detection.",
      },
      {
        kind: "feature",
        text: "Compliance mapping expanded to 51 controls across PCI-DSS, SOC 2, GDPR, Play Store, App Store.",
      },
      {
        kind: "improvement",
        text: "Compliance dashboard now shows per-framework percentages and per-control evidence.",
      },
    ],
  },
  {
    version: "v0.3.0",
    date: "2026-04-22",
    title: "Drift detection + activity feed",
    icon: Zap,
    changes: [
      {
        kind: "feature",
        text: "Drift alerts — EDITH compares each new scan to the previous and flags newly-introduced issues per commit.",
      },
      {
        kind: "feature",
        text: "Activity feed across repos with author, severity, and finding count.",
      },
      {
        kind: "fix",
        text: "Inngest v4 — corrected trigger config (now an array inside the first arg).",
      },
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-04-08",
    title: "Async scans + AI-pattern checker",
    icon: Bot,
    changes: [
      {
        kind: "feature",
        text: "Scans now run via Inngest workers — webhook returns 202, scan completes in background, PR comment fires on completion.",
      },
      {
        kind: "feature",
        text: "AI-pattern checks — silent catch blocks, stub routes, placeholder pages, FIXME/HACK comments, console.log in prod.",
      },
      {
        kind: "improvement",
        text: "ts-morph project now built in-memory; 60s p50 scan time on 400-file repos.",
      },
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-03-24",
    title: "v0 + v1 scanner core",
    icon: Shield,
    changes: [
      {
        kind: "feature",
        text: "v0 — 8 regex-based checks (secrets in bundles, env-var leaks, mixed content, missing security headers).",
      },
      {
        kind: "feature",
        text: "v1 — 8 AST-based checks (process.env tracking, type-erasure, Stripe webhook signature verification, SQL injection via templates, RLS).",
      },
      {
        kind: "feature",
        text: "GitHub App + webhook flow — automated scans on push / PR.",
      },
      {
        kind: "feature",
        text: "Score, dimensions, severity, and a /dashboard surface.",
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <PageBackground />
      <NavBar />
      <main className="relative z-10 flex-1 overflow-x-hidden">
        <Hero />
        <Timeline />
        <Footer />
      </main>
    </>
  );
}

function Hero() {
  return (
    <section className="relative pt-14">
      <div className="mx-auto max-w-5xl px-6 pb-12 pt-20 lg:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            <FileText className="h-3 w-3" />
            Changelog · updated {RELEASES[0].date}
          </div>
          <h1 className="mt-6 text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] text-[var(--text)] sm:text-[56px]">
            Everything we{" "}
            <span className="text-[var(--accent)]">shipped.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15.5px] leading-[1.6] text-[var(--text-dim)]">
            A running log of EDITH releases — new checks, framework support,
            integrations, fixes. Honest about what's broken and what's new.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function Timeline() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="relative">
          {/* vertical line */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[15px] top-2 bottom-2 hidden w-px bg-[var(--border)] md:block"
          />
          <div className="flex flex-col gap-8">
            {RELEASES.map((r, i) => (
              <ReleaseRow key={r.version} release={r} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReleaseRow({
  release,
  index,
}: {
  release: Release;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.2) }}
      className="relative md:pl-12"
    >
      {/* timeline dot */}
      <div
        aria-hidden
        className="absolute left-0 top-3 hidden h-8 w-8 -translate-x-px items-center justify-center rounded-full border border-[var(--accent)]/40 bg-[var(--bg-elev)] md:flex"
      >
        <release.icon
          className="h-3.5 w-3.5 text-[var(--accent)]"
          strokeWidth={1.75}
        />
      </div>

      <MagicCard className="p-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            {release.version}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {release.date}
          </span>
          {release.badge && (
            <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {release.badge}
            </span>
          )}
        </div>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.015em] text-[var(--text)]">
          {release.title}
        </h2>
        {release.highlight && (
          <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
            {release.highlight}
          </p>
        )}
        <ul className="mt-5 space-y-2.5">
          {release.changes.map((c, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <KindChip kind={c.kind} />
              <span className="text-[13px] leading-[1.55] text-[var(--text)]">
                {c.text}
              </span>
            </li>
          ))}
        </ul>
      </MagicCard>
    </motion.article>
  );
}

function KindChip({ kind }: { kind: ChangeKind }) {
  const map: Record<
    ChangeKind,
    { label: string; bg: string; fg: string; border: string }
  > = {
    feature: {
      label: "NEW",
      bg: "bg-[var(--accent-soft)]",
      fg: "text-[var(--accent)]",
      border: "border-[var(--accent)]/40",
    },
    improvement: {
      label: "IMP",
      bg: "bg-[rgba(107,174,214,0.10)]",
      fg: "text-[var(--cool-2)]",
      border: "border-[rgba(107,174,214,0.40)]",
    },
    fix: {
      label: "FIX",
      bg: "bg-[rgba(74,222,128,0.08)]",
      fg: "text-[var(--success)]",
      border: "border-[rgba(74,222,128,0.40)]",
    },
    security: {
      label: "SEC",
      bg: "bg-[rgba(248,113,113,0.08)]",
      fg: "text-[var(--danger)]",
      border: "border-[rgba(248,113,113,0.40)]",
    },
  };
  const c = map[kind];
  return (
    <span
      className={`mt-0.5 inline-flex h-5 w-10 shrink-0 items-center justify-center rounded border ${c.bg} ${c.fg} ${c.border} font-mono text-[9px] font-semibold tracking-[0.18em]`}
    >
      {c.label}
    </span>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-[var(--border)] py-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        <div className="flex items-center gap-3">
          <GitBranch className="h-3 w-3" />
          {RELEASES.length} releases · open source roadmap on GitHub
        </div>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="hover:text-[var(--text)]">
            Docs
          </Link>
          <Link
            href="/signin"
            className="text-[var(--accent)] hover:brightness-110"
          >
            Connect GitHub →
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* Unused-import suppressors */
void ArrowRight;
void Check;
void Database;
void Terminal;
void Wrench;
