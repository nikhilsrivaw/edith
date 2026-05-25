"use client";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  FileText,
  GitBranch,
  Search,
} from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

import { NavBar } from "@/components/edith/nav-bar";
import { PageBackground } from "@/components/edith/page-background";
import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { MagicCard } from "@/components/spectrum-ui/magic-card";
import { DOCS } from "./_content";

const QUICK_START = [
  {
    n: "01",
    title: "Sign in with GitHub",
    desc: "OAuth, read-only access. Eight seconds.",
  },
  {
    n: "02",
    title: "Pick a repo",
    desc: "EDITH lists every repo you have access to. Pick one.",
  },
  {
    n: "03",
    title: "Run your first scan",
    desc: "60 seconds for most repos. Issues appear with file + line.",
  },
  {
    n: "04",
    title: "Copy a fix prompt",
    desc: "Paste into Cursor / Claude / Copilot. Done.",
  },
];

export default function DocsPage() {
  return (
    <>
      <PageBackground />
      <NavBar />
      <main className="relative z-10 flex-1 overflow-x-hidden">
        <Hero />
        <QuickStart />
        <Sections />
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
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            <FileText className="h-3 w-3" />
            Documentation · v1.0 · {DOCS.length} guides
          </div>
          <h1 className="mt-6 text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] text-[var(--text)] sm:text-[56px]">
            Read it. Ship it.{" "}
            <span className="text-[var(--accent)]">Audit it.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15.5px] leading-[1.6] text-[var(--text-dim)]">
            Everything you need to get EDITH running across your repos, your
            CI, your editor, and your browser. Written for builders, not
            auditors.
          </p>

          {/* Search mock */}
          <div className="mt-7 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-2.5 transition-colors hover:border-[var(--border-hot)]">
            <Search
              className="h-3.5 w-3.5 text-[var(--text-muted)]"
              strokeWidth={2}
            />
            <input
              type="text"
              placeholder="Search docs — try 'webhook signature' or 'SSRF'"
              className="flex-1 bg-transparent font-mono text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <kbd className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-muted)]">
              ⌘K
            </kbd>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function QuickStart() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
              Quick start
            </div>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              Four steps to your first scan.
            </h2>
          </div>
          <Link
            href="/docs/getting-started"
            className="hidden items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--accent)] hover:text-[var(--text)] sm:inline-flex"
          >
            Full guide <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="relative grid gap-4 md:grid-cols-4">
          <div
            aria-hidden
            className="pointer-events-none absolute left-[12%] right-[12%] top-7 hidden border-t border-dashed border-[var(--accent)]/30 md:block"
          />
          {QUICK_START.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="relative"
            >
              <SpotlightCard className="h-full p-5">
                <div className="grid h-7 w-7 place-items-center rounded-full border border-[var(--accent)]/40 bg-[var(--bg)] font-mono text-[10px] font-semibold tabular-nums text-[var(--accent)]">
                  {s.n}
                </div>
                <h3 className="mt-4 text-[14px] font-semibold text-[var(--text)]">
                  {s.title}
                </h3>
                <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
                  {s.desc}
                </p>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sections() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            Reference
          </div>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            Browse by topic.
          </h2>
          <p className="mt-2 text-[13.5px] text-[var(--text-dim)]">
            {DOCS.length} guides ·{" "}
            {DOCS.reduce((s, d) => s + d.sections.length, 0)} sections.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {DOCS.map((d, i) => (
            <motion.div
              key={d.slug}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 6) * 0.03 }}
            >
              <Link href={`/docs/${d.slug}`} className="block h-full">
                <MagicCard className="group h-full p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)]">
                      <d.icon className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-[14px] font-semibold text-[var(--text)]">
                          {d.title}
                        </h3>
                        <ChevronRight
                          className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
                          strokeWidth={2}
                        />
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
                        {d.description}
                      </p>
                      <div className="mt-3 flex items-center gap-4 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3 w-3" strokeWidth={1.75} />
                          {d.estimatedRead}
                        </span>
                        <span>{d.sections.length} sections</span>
                      </div>
                    </div>
                  </div>
                </MagicCard>
              </Link>
            </motion.div>
          ))}
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
          <GitBranch className="h-3 w-3" />
          docs · v1.0 · last updated 2026-05-23
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-[var(--text)]">
            ← Back to landing
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
