"use client";
import { ArrowRight, Check, Minus } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { NavBar } from "@/components/edith/nav-bar";
import { CleanCard } from "@/components/edith/clean-card";

type Currency = "INR" | "USD";

const TIERS = [
  {
    id: "free",
    name: "Free",
    inr: 0,
    usd: 0,
    desc: "For weekend projects and curiosity.",
    features: ["1 repo", "Weekly scans", "Basic report", "EDITH score badge"],
    cta: "Start free",
    featured: false,
  },
  {
    id: "builder",
    name: "Builder",
    inr: 499,
    usd: 9,
    desc: "For indie devs shipping side projects.",
    features: [
      "5 repos",
      "Daily scans",
      "Fix prompts for Cursor / Claude Code",
      "PR comments",
      "Slack notifications",
    ],
    cta: "Start Builder",
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    inr: 1499,
    usd: 29,
    desc: "For teams that ship every day.",
    features: [
      "Unlimited repos",
      "Real-time scans on every push",
      "Drift detection + circuit breaker",
      "Testing engine (auth, input, access)",
      "API tokens",
      "Slack + email digest",
    ],
    cta: "Start Pro",
    featured: true,
  },
  {
    id: "agency",
    name: "Agency",
    inr: 3999,
    usd: 79,
    desc: "For studios with client work.",
    features: [
      "Everything in Pro",
      "Client workspaces",
      "White-label PR comments",
      "Dedicated reviewer (humans)",
      "SAML SSO",
      "Priority support · 2h SLA",
    ],
    cta: "Talk to us",
    featured: false,
  },
];

const COMPARISON: {
  group: string;
  rows: { feat: string; free: boolean | string; builder: boolean | string; pro: boolean | string; agency: boolean | string }[];
}[] = [
  {
    group: "Scanning",
    rows: [
      { feat: "Repos", free: "1", builder: "5", pro: "Unlimited", agency: "Unlimited" },
      { feat: "Scan frequency", free: "Weekly", builder: "Daily", pro: "Real-time", agency: "Real-time" },
      { feat: "All 30 checks", free: true, builder: true, pro: true, agency: true },
      { feat: "Testing engine (auth/input/access)", free: false, builder: false, pro: true, agency: true },
      { feat: "Drift detection", free: false, builder: false, pro: true, agency: true },
    ],
  },
  {
    group: "Integrations",
    rows: [
      { feat: "PR comments", free: false, builder: true, pro: true, agency: true },
      { feat: "Slack alerts", free: false, builder: true, pro: true, agency: true },
      { feat: "Fix prompts (Cursor, Claude, Windsurf, v0)", free: false, builder: true, pro: true, agency: true },
      { feat: "API tokens", free: false, builder: false, pro: true, agency: true },
      { feat: "White-label PR comments", free: false, builder: false, pro: false, agency: true },
    ],
  },
  {
    group: "Support",
    rows: [
      { feat: "Email support", free: "48h", builder: "24h", pro: "8h", agency: "2h" },
      { feat: "Dedicated reviewer (human)", free: false, builder: false, pro: false, agency: true },
      { feat: "SAML SSO", free: false, builder: false, pro: false, agency: true },
    ],
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is the trial really free? No card required?",
    a: "Correct. Free tier doesn't ask for a card. Builder and Pro have a 14-day trial; you'll only be charged after the trial ends and you've kept the plan.",
  },
  {
    q: "Why bill via PayU?",
    a: "PayU has the best UPI, NetBanking, and card flow for Indian customers, and supports international cards for everyone else. We considered Razorpay; PayU's payout reliability won out.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. Upgrades are prorated immediately. Downgrades take effect at the end of the current billing cycle so you don't lose paid days.",
  },
  {
    q: "What does EDITH have access to?",
    a: "Read-only access to repos you select, plus write access for check statuses on PRs. Source code is cloned to our scan workers, scanned, and discarded. We never read code outside the repos you connect.",
  },
  {
    q: "Do you offer refunds?",
    a: "14-day money-back guarantee on first paid month. After that, we prorate refunds for unused days if you cancel early.",
  },
];

export default function PricingPage() {
  const [currency, setCurrency] = useState<Currency>("INR");

  return (
    <>
      <NavBar />
      <main className="relative flex-1 overflow-x-hidden">
        <section className="px-6 pb-12 pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
              Pricing
            </div>
            <h1 className="mt-3 text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--text)] sm:text-[52px]">
              Pay for what your team ships.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.6] text-[var(--text-dim)]">
              Four tiers. No seat math. Cancel any time. Billing in INR via PayU
              — international cards welcome too.
            </p>

            <div className="mt-7 inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--bg-elev)] p-1 font-mono text-[10px] uppercase tracking-[0.22em]">
              {(["INR", "USD"] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`h-7 rounded-full px-4 transition-colors ${
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

          <div className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => {
              const price = currency === "INR" ? `₹${t.inr.toLocaleString("en-IN")}` : `$${t.usd}`;
              return (
                <div
                  key={t.id}
                  className={`relative rounded-xl border bg-[var(--bg-elev)] p-7 transition-colors ${
                    t.featured
                      ? "border-[var(--accent)]/60 shadow-[0_0_60px_-20px_var(--accent-glow)]"
                      : "border-[var(--border)] hover:border-[var(--border-hot)]"
                  }`}
                >
                  {t.featured && (
                    <span className="absolute -top-3 right-5 rounded-full bg-[var(--accent)] px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--bg)]">
                      Most popular
                    </span>
                  )}
                  {!t.featured && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
                    />
                  )}
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                    {t.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="font-mono text-[34px] font-semibold tabular-nums text-[var(--text)]">
                      {price}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-dim)]">
                      /mo
                    </span>
                  </div>
                  <p className="mt-4 min-h-[40px] text-[13px] leading-[1.55] text-[var(--text-dim)]">
                    {t.desc}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-[var(--text)]">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
                          strokeWidth={2.5}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] transition-all ${
                      t.featured
                        ? "bg-[var(--accent)] text-[var(--bg)] hover:brightness-110"
                        : "border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-hot)] hover:bg-[var(--bg-elev-2)]"
                    }`}
                  >
                    {t.cta} <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Comparison */}
        <section className="px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
                Plan comparison
              </div>
              <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                Side by side, no fine-print.
              </h2>
            </div>

            <CleanCard className="p-0" withAccent={false} hoverable={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-elev-2)] font-mono text-[10px] uppercase tracking-[0.22em]">
                      <th className="px-5 py-4 text-[var(--text-dim)]">
                        Feature
                      </th>
                      {TIERS.map((t) => (
                        <th
                          key={t.id}
                          className={`px-4 py-4 text-center ${t.featured ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-dim)]"}`}
                        >
                          {t.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((group) => (
                      <Fragment key={group.group}>
                        <tr>
                          <td
                            colSpan={5}
                            className="border-t border-[var(--border)] bg-[var(--bg)] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]"
                          >
                            {group.group}
                          </td>
                        </tr>
                        {group.rows.map((r, idx) => (
                          <tr
                            key={`${group.group}-${idx}`}
                            className="border-t border-[var(--border)]"
                          >
                            <td className="px-5 py-3 text-[13px] text-[var(--text)]">
                              {r.feat}
                            </td>
                            {(["free", "builder", "pro", "agency"] as const).map(
                              (k) => (
                                <td
                                  key={k}
                                  className={`px-4 py-3 text-center ${k === "pro" ? "bg-[var(--accent-soft)]" : ""}`}
                                >
                                  <CompCell v={r[k]} accent={k === "pro"} />
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CleanCard>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
                FAQ
              </div>
              <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                Questions we get every week.
              </h2>
            </div>
            <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]">
              {FAQ.map((f, i) => (
                <Faq key={i} q={f.q} a={f.a} />
              ))}
            </div>
            <p className="mt-8 text-center text-[13px] text-[var(--text-dim)]">
              Still curious?{" "}
              <Link
                href="mailto:support@edith.expert"
                className="text-[var(--accent)] hover:brightness-110"
              >
                support@edith.expert
              </Link>{" "}
              · we&apos;re humans, we reply.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}

function CompCell({
  v,
  accent,
}: {
  v: boolean | string;
  accent?: boolean;
}) {
  if (v === true)
    return (
      <Check
        className={`mx-auto h-4 w-4 ${accent ? "text-[var(--accent)]" : "text-[var(--cool-1)]"}`}
        strokeWidth={2.5}
      />
    );
  if (v === false)
    return (
      <Minus
        className="mx-auto h-4 w-4 text-[var(--text-muted)]"
        strokeWidth={2}
      />
    );
  return (
    <span
      className={`font-mono text-[11px] ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}
    >
      {v}
    </span>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="block w-full text-left"
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <span className="text-[14.5px] font-medium text-[var(--text)]">
          {q}
        </span>
        <span
          className={`font-mono text-[16px] text-[var(--text-muted)] transition-transform ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </div>
      {open && (
        <div className="px-5 pb-5 text-[13.5px] leading-[1.65] text-[var(--text-dim)]">
          {a}
        </div>
      )}
    </button>
  );
}
