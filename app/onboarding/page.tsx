"use client";
import {
  ArrowRight,
  Check,
  Loader2,
  Search,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CleanCard } from "@/components/edith/clean-card";
import { EdithLogo } from "@/components/edith/logo";
import { GithubMark } from "@/components/edith/github-mark";
import { ScorePill } from "@/components/edith/score-pill";

type StepId = 1 | 2 | 3 | 4 | 5;
const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Connect GitHub" },
  { id: 3, label: "Select repos" },
  { id: 4, label: "First scan" },
  { id: 5, label: "Results" },
];

const MOCK_REPOS = [
  { name: "checkout-app", desc: "Next.js · Stripe", stars: 84 },
  { name: "admin-panel", desc: "Next.js · Supabase", stars: 12 },
  { name: "marketing-site", desc: "Next.js · Sanity", stars: 6 },
  { name: "api-gateway", desc: "Next.js · Redis", stars: 41 },
  { name: "mobile-api", desc: "Next.js · Postgres", stars: 22 },
];

export default function OnboardingPage() {
  const [step, setStep] = useState<StepId>(1);
  const [installed, setInstalled] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(
    new Set(["checkout-app", "admin-panel"]),
  );
  const [scanProgress, setScanProgress] = useState(0);

  // simulate scan progress on step 4
  useEffect(() => {
    if (step !== 4) return;
    setScanProgress(0);
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 8 + 3;
      if (p >= 100) {
        p = 100;
        clearInterval(id);
        setTimeout(() => setStep(5), 700);
      }
      setScanProgress(p);
    }, 220);
    return () => clearInterval(id);
  }, [step]);

  const toggleRepo = (name: string) =>
    setSelectedRepos((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="min-h-svh bg-[var(--bg)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <EdithLogo />
          <Link
            href="/dashboard"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Skip for now
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* progress */}
        <ol className="mb-10 grid grid-cols-5 gap-2">
          {STEPS.map((s) => {
            const done = s.id < step;
            const current = s.id === step;
            return (
              <li key={s.id} className="flex flex-col gap-2">
                <div
                  className={`h-1 rounded-full ${
                    done || current
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--border)]"
                  }`}
                />
                <div
                  className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                    done || current
                      ? "text-[var(--text)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {String(s.id).padStart(2, "0")} · {s.label}
                </div>
              </li>
            );
          })}
        </ol>

        <CleanCard className="p-8">
          {step === 1 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                Welcome
              </div>
              <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text)]">
                Glad you&apos;re here. Let&apos;s set EDITH up.
              </h1>
              <p className="mt-3 max-w-xl text-[14px] leading-[1.65] text-[var(--text-dim)]">
                In the next four steps you&apos;ll connect a GitHub repository,
                run your first 30-check scan, and walk away with a copy-pasteable
                fix prompt for your editor of choice. Takes about two minutes.
              </p>
              <ul className="mt-6 space-y-2.5 text-[13.5px] text-[var(--text-dim)]">
                <li className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
                    strokeWidth={2.25}
                  />
                  Read-only GitHub access. We never push code.
                </li>
                <li className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
                    strokeWidth={2.25}
                  />
                  Scans run in our infra, not yours.
                </li>
                <li className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
                    strokeWidth={2.25}
                  />
                  Cancel any time. Account purged on request.
                </li>
              </ul>
              <StepFooter
                onNext={() => setStep(2)}
                nextLabel="Continue"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                Step 02 · Connect GitHub
              </div>
              <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                Install the EDITH GitHub App.
              </h1>
              <p className="mt-3 max-w-xl text-[14px] leading-[1.65] text-[var(--text-dim)]">
                You pick which repos EDITH can see. We request read-only code
                access and webhook delivery — nothing else.
              </p>

              <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)]">
                    <Shield
                      className="h-4 w-4 text-[var(--accent)]"
                      strokeWidth={1.75}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold text-[var(--text)]">
                      Read-only scope
                    </div>
                    <ul className="mt-2 space-y-1 font-mono text-[11px] text-[var(--text-dim)]">
                      <li>read · contents</li>
                      <li>read · pull_requests</li>
                      <li>read · metadata</li>
                      <li>write · checks (PR status only)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {!installed ? (
                <button
                  onClick={() => setInstalled(true)}
                  className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110"
                >
                  <GithubMark className="h-4 w-4" />
                  Install GitHub App
                </button>
              ) : (
                <div className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--success)]/40 bg-[rgba(74,222,128,0.1)] px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--success)]">
                  <Check className="h-4 w-4" strokeWidth={2.25} />
                  Installed · acme org
                </div>
              )}

              <StepFooter
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                nextDisabled={!installed}
                nextLabel="Continue"
              />
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                Step 03 · Select repos
              </div>
              <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                Which repos should EDITH watch?
              </h1>
              <p className="mt-3 max-w-xl text-[14px] text-[var(--text-dim)]">
                Pick at least one. You can add more later from the dashboard.
              </p>

              <div className="mt-6 flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3">
                <Search
                  className="h-3.5 w-3.5 text-[var(--text-muted)]"
                  strokeWidth={1.75}
                />
                <input
                  type="text"
                  placeholder="Filter your repos"
                  className="h-full flex-1 bg-transparent text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
              </div>

              <ul className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)]">
                {MOCK_REPOS.map((r) => {
                  const checked = selectedRepos.has(r.name);
                  return (
                    <li key={r.name}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-elev-2)]/40">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRepo(r.name)}
                          className="sr-only"
                        />
                        <span
                          className={`grid h-4 w-4 place-items-center rounded border ${
                            checked
                              ? "border-[var(--accent)] bg-[var(--accent)]"
                              : "border-[var(--border-hot)]"
                          }`}
                        >
                          {checked && (
                            <Check
                              className="h-3 w-3 text-[var(--bg)]"
                              strokeWidth={3}
                            />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] text-[var(--text)]">
                            {r.name}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                            {r.desc}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-[var(--text-dim)]">
                          ★ {r.stars}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <StepFooter
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
                nextDisabled={selectedRepos.size === 0}
                nextLabel={`Scan ${selectedRepos.size} ${selectedRepos.size === 1 ? "repo" : "repos"}`}
              />
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                Step 04 · First scan
              </div>
              <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                Running 30 checks across {selectedRepos.size}{" "}
                {selectedRepos.size === 1 ? "repo" : "repos"}…
              </h1>
              <p className="mt-3 max-w-xl text-[14px] text-[var(--text-dim)]">
                Average scan takes 60 seconds. You can leave this page open or
                come back later.
              </p>

              <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-6">
                <div className="flex items-center gap-3">
                  <Loader2
                    className="h-4 w-4 animate-spin text-[var(--accent)]"
                    strokeWidth={2}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                    Cloning · {Math.min(100, Math.round(scanProgress))}%
                  </span>
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <span
                    className="block h-full bg-[var(--accent)] transition-all duration-200"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
                <ul className="mt-5 space-y-1.5 font-mono text-[11px] text-[var(--text-muted)]">
                  <ScanStep done={scanProgress > 20} text="Shallow clone · main branch" />
                  <ScanStep done={scanProgress > 45} text="Parse TS/TSX with ts-morph" />
                  <ScanStep done={scanProgress > 75} text="Run security · performance · data-safety checks" />
                  <ScanStep done={scanProgress > 92} text="Compute EDITH Score" />
                </ul>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--success)]">
                <Check className="h-3 w-3" strokeWidth={2.5} />
                Step 05 · Done
              </div>
              <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                Your first scan is in.
              </h1>
              <p className="mt-3 max-w-xl text-[14px] text-[var(--text-dim)]">
                Here&apos;s how your repos look. Click any repo to dig into the
                issues and grab fix prompts.
              </p>

              <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)]">
                {[...selectedRepos].map((name, i) => {
                  const score = [78, 91, 64, 88, 85][i] ?? 80;
                  return (
                    <li
                      key={name}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <ScorePill score={score} size="sm" />
                      <div className="flex-1">
                        <div className="text-[13.5px] text-[var(--text)]">
                          {name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          30 checks · 8 issues
                        </div>
                      </div>
                      <Link
                        href={`/repos/${name === "checkout-app" ? "checkout-app" : "admin-panel"}`}
                        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 flex justify-end">
                <Link
                  href="/dashboard"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110"
                >
                  Go to dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </CleanCard>
      </main>
    </div>
  );
}

function StepFooter({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] pt-5">
      {onBack ? (
        <button
          onClick={onBack}
          className="inline-flex h-9 items-center font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          ← Back
        </button>
      ) : (
        <span />
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextLabel} <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ScanStep({ done, text }: { done: boolean; text: string }) {
  return (
    <li
      className={`flex items-center gap-2 ${done ? "text-[var(--text-dim)]" : "text-[var(--text-muted)]"}`}
    >
      <span
        className={`grid h-3 w-3 place-items-center rounded-full ${done ? "bg-[var(--success)]" : "border border-[var(--border-hot)]"}`}
      >
        {done && (
          <Check className="h-2 w-2 text-[var(--bg)]" strokeWidth={3} />
        )}
      </span>
      <span>{text}</span>
    </li>
  );
}
