"use client";
import {
  Apple,
  ArrowRight,
  Check,
  CreditCard,
  Download,
  FileText,
  Lock,
  PlayCircle,
  ScrollText,
  ShieldCheck,
  Sparkles as SparkleIcon,
  UserCheck,
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

type Framework = {
  id: string;
  name: string;
  icon: LucideIcon;
  controls: number;
  color: string;
  blurb: string;
  topChecks: string[];
};

const FRAMEWORKS: Framework[] = [
  {
    id: "pci",
    name: "PCI-DSS 4.0",
    icon: CreditCard,
    controls: 16,
    color: "#FFB627",
    blurb:
      "If you handle card data — PCI is non-negotiable. EDITH covers the development-facing controls: injection, broken auth, secure storage, transmission, error handling.",
    topChecks: [
      "Injection flaws (6.5.1)",
      "Broken auth + session mgmt (6.5.10)",
      "Cross-site scripting (6.5.7)",
      "Insecure direct object references (6.5.8)",
      "Cross-site request forgery (6.5.9)",
      "Encryption of stored card data (3.5)",
      "Strong authentication (8.2)",
    ],
  },
  {
    id: "soc2",
    name: "SOC 2",
    icon: ShieldCheck,
    controls: 10,
    color: "#6BAED6",
    blurb:
      "The Trust Services Criteria — Security, Availability, Confidentiality. Auditors ask 'how do you know?' EDITH's continuous scans are the evidence.",
    topChecks: [
      "Logical access controls (CC6.1)",
      "Encryption in transit (CC6.6)",
      "Restrict transmission of data (CC6.7)",
      "Detect anomalies (CC7.1)",
      "Monitor system components (CC7.2)",
      "Change management (CC8.1)",
      "Confidential data ID (CC9.1)",
    ],
  },
  {
    id: "gdpr",
    name: "GDPR",
    icon: UserCheck,
    controls: 14,
    color: "#A78BFA",
    blurb:
      "EU data protection. Art 32 (security obligations) + Art 25 (privacy by design) + Articles 7, 13, 17, 20 (consent, info, erasure, portability) — fully mapped.",
    topChecks: [
      "Pseudonymisation + encryption (Art 32(1))",
      "Confidentiality + integrity (Art 32(2))",
      "Data minimisation (Art 5(1)(c))",
      "Right to erasure (Art 17)",
      "Right to portability (Art 20)",
      "Conditions for consent (Art 7)",
      "Information at collection (Art 13)",
    ],
  },
  {
    id: "play",
    name: "Google Play Store",
    icon: PlayCircle,
    controls: 11,
    color: "#34D399",
    blurb:
      "If your app ships to Play Store — data-safety form readiness, secure transmission, session management, accessibility. EDITH flags the violations before review.",
    topChecks: [
      "Data Safety form accuracy",
      "Secure transmission (HTTPS-only)",
      "No hardcoded credentials",
      "No tokens in localStorage",
      "Session mgmt (HttpOnly, Secure)",
      "Webhook verification",
      "Accessibility (WCAG 2.1 AA)",
    ],
  },
  {
    id: "app",
    name: "Apple App Store",
    icon: Apple,
    controls: 11,
    color: "#F472B6",
    blurb:
      "Review guidelines 5.1.1 (privacy), 5.1.2 (data use), ATS, keychain, session security. Pass review on the first submission.",
    topChecks: [
      "App Transport Security (ATS)",
      "Keychain for secrets",
      "Secure session cookies",
      "5.1.1 — Minimum data collection",
      "5.1.2 — Documented data use",
      "Webhook signature verification",
      "Strong CSP",
    ],
  },
];

export default function CompliancePage() {
  return (
    <>
      <PageBackground />
      <NavBar />
      <main className="relative z-10 flex-1 overflow-x-hidden">
        <Hero />
        <Stats />
        <Frameworks />
        <AuditorReport />
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
            <ShieldCheck className="h-3 w-3" />
            Compliance · 5 frameworks · 62 controls
          </div>
          <h1 className="mt-6 text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] text-[var(--text)] sm:text-[60px]">
            Audit-grade evidence,{" "}
            <span className="text-[var(--accent)]">on autopilot.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15.5px] leading-[1.6] text-[var(--text-dim)]">
            Every EDITH finding maps to specific compliance controls across
            PCI-DSS, SOC 2, GDPR, Play Store, and Apple App Store. When
            auditors ask "how do you know?" — you point at the continuous
            scan history and the auto-generated report.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function Stats() {
  const stats: { value: number; label: string }[] = [
    { value: 5, label: "Frameworks" },
    { value: 62, label: "Controls" },
    { value: 295, label: "Check ↔ control rows" },
    { value: 100, label: "% automation" },
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
              <NumberTicker
                value={s.value}
                duration={1600}
                suffix={s.label.startsWith("%") ? "%" : ""}
              />
              {s.label === "% automation" && (
                <span className="font-mono text-[24px]">%</span>
              )}
            </div>
            <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {s.label.startsWith("%") ? s.label.replace("%", "").trim() : s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Frameworks() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-7 max-w-2xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            Coverage
          </div>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            Five frameworks. Same scan.
          </h2>
          <p className="mt-3 text-[14px] leading-[1.6] text-[var(--text-dim)]">
            One commit triggers one scan. EDITH then projects every finding
            across all five frameworks at once — so passing your SOC 2 audit
            also gets you closer to Play Store launch.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {FRAMEWORKS.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: (i % 2) * 0.06 }}
            >
              <MagicCard className="h-full p-6">
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-md border"
                    style={{
                      color: f.color,
                      borderColor: `color-mix(in srgb, ${f.color} 40%, transparent)`,
                      background: `color-mix(in srgb, ${f.color} 10%, transparent)`,
                    }}
                  >
                    <f.icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[17px] font-semibold tracking-tight text-[var(--text)]">
                        {f.name}
                      </h3>
                      <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color: f.color }}
                        >
                          {f.controls}
                        </span>{" "}
                        controls
                      </div>
                    </div>
                    <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
                      {f.blurb}
                    </p>
                  </div>
                </div>

                <ul className="mt-5 grid grid-cols-1 gap-2 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
                  {f.topChecks.map((ck) => (
                    <li
                      key={ck}
                      className="flex items-start gap-2 text-[12px] leading-[1.5] text-[var(--text)]"
                    >
                      <Check
                        className="mt-0.5 h-3 w-3 shrink-0"
                        style={{ color: f.color }}
                        strokeWidth={2.5}
                      />
                      {ck}
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

function AuditorReport() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
              Auditor report
            </div>
            <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              One click. One PDF.
              <br />
              Audit-ready.
            </h2>
            <p className="mt-4 text-[14px] leading-[1.6] text-[var(--text-dim)]">
              Pro and Agency plans generate a signed PDF that maps every
              EDITH finding to the framework controls it violates or
              satisfies. Includes scan history, evidence per control, and a
              summary you can hand to your SOC 2 auditor on day one.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Per-framework pass / fail percentage",
                "Per-control evidence with check ID + scan timestamp",
                "Continuous scan history — auditors love the timeline",
                "White-label option on Agency tier",
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-[var(--text)]"
                >
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
                    strokeWidth={2.5}
                  />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110"
              >
                <Download className="h-3 w-3" />
                See plans
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/coverage"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-transparent px-4 py-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--text)] transition-all hover:border-[var(--border-hot)] hover:bg-[var(--bg-elev)]"
              >
                See checks
              </Link>
            </div>
          </motion.div>

          {/* Mock report card */}
          <motion.div
            initial={{ opacity: 0, x: 14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <SpotlightCard className="relative h-full overflow-hidden p-0">
              {/* PDF-style header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elev-2)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--text)]">
                    krova-soc2-2026Q2.pdf
                  </span>
                </div>
                <span className="rounded border border-[var(--success)]/40 bg-[rgba(74,222,128,0.08)] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--success)]">
                  Signed
                </span>
              </div>

              {/* Mock content */}
              <div className="space-y-5 p-6">
                {/* Title block */}
                <div className="border-b border-[var(--border)] pb-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                    EDITH · Compliance evidence report
                  </div>
                  <div className="mt-1 text-[18px] font-semibold tracking-tight text-[var(--text)]">
                    SOC 2 — Q2 2026
                  </div>
                  <div className="mt-2 flex items-center gap-3 font-mono text-[10.5px] text-[var(--text-muted)]">
                    <span>krova/payments</span>
                    <span>·</span>
                    <span>2026-04-01 → 2026-05-23</span>
                  </div>
                </div>

                {/* Per-framework rows */}
                <div className="space-y-3">
                  {[
                    { label: "CC6.1 — Logical access", pass: 92 },
                    { label: "CC6.7 — Restrict data", pass: 100 },
                    { label: "CC7.2 — Monitor systems", pass: 88 },
                    { label: "CC8.1 — Change mgmt", pass: 95 },
                  ].map((row) => (
                    <div key={row.label} className="grid grid-cols-[1fr_auto_42px] items-center gap-3">
                      <div className="truncate text-[12.5px] text-[var(--text)]">
                        {row.label}
                      </div>
                      <div className="h-1 w-32 overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${row.pass}%`,
                            background:
                              row.pass >= 90
                                ? "var(--success)"
                                : "var(--accent)",
                          }}
                        />
                      </div>
                      <div
                        className="text-right font-mono text-[11px] font-semibold tabular-nums"
                        style={{
                          color:
                            row.pass >= 90
                              ? "var(--success)"
                              : "var(--accent)",
                        }}
                      >
                        {row.pass}%
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[var(--border)] pt-4">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    <span>Overall posture</span>
                    <span className="text-[var(--success)]">93% · ready</span>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>
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
          Save the audit budget for things that need a human
        </div>
        <h2 className="mt-5 text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--text)] sm:text-[42px]">
          Compliance evidence{" "}
          <span className="text-[var(--accent)]">on every commit.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.6] text-[var(--text-dim)]">
          Connect your GitHub. EDITH scans your last commit and shows you
          exactly which controls you pass — and which you'd fail on audit
          day.
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
        <div className="flex items-center gap-3">
          <Lock className="h-3 w-3" />
          5 frameworks · 62 controls · 295+ mappings
        </div>
        <div className="flex items-center gap-4">
          <Link href="/coverage" className="hover:text-[var(--text)]">
            Coverage →
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

/* Unused-import suppressors */
void ScrollText;
