"use client";
import { Loader2, Wand2 } from "lucide-react";
import { useState } from "react";
import { CleanCard } from "@/components/edith/clean-card";
import { SeverityBadge } from "@/components/edith/severity-badge";
import { Topbar } from "@/components/edith/topbar";

type Pitfall = {
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  why: string;
  watchFor: string;
  promptHint: string;
};

type Result = {
  summary: string;
  pitfalls: Pitfall[];
};

export default function PlanCheckPage() {
  const [plan, setPlan] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRun = async () => {
    if (plan.trim().length < 20) {
      setError("Plan must be at least 20 characters.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/plan-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        summary?: string;
        pitfalls?: Pitfall[];
        error?: string;
      };
      if (!json.ok) {
        setError(json.error ?? "plan-check failed");
      } else {
        setResult({
          summary: json.summary ?? "",
          pitfalls: json.pitfalls ?? [],
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const reinforcedPrompt =
    result && plan
      ? `${plan.trim()}\n\nGuardrails (from EDITH):\n${result.pitfalls
          .map((p, i) => `${i + 1}. ${p.promptHint}`)
          .join("\n")}`
      : "";

  return (
    <>
      <Topbar
        title="Plan validation"
        subtitle="Paste your plan. EDITH warns about the pitfalls Cursor / Claude / v0 will walk into — before you let them write the code."
      />
      <main className="flex-1 px-6 py-6">
        <CleanCard className="p-5">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">
            Your plan
          </h2>
          <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
            A few paragraphs describing the change you want to make. EDITH
            returns a ranked list of pitfalls + a one-line prompt addendum per
            pitfall.
          </p>
          <textarea
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            rows={8}
            placeholder={`Example:

I want to add Stripe checkout to my existing Next.js app. Customers in India should be routed to Razorpay instead. Orders are stored in the existing public.orders table. After payment, the user should land on a thank-you page that displays the order id.`}
            className="mt-3 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[13px] leading-[1.6] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-hot)] focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {plan.length} chars
            </span>
            <button
              onClick={onRun}
              disabled={running}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  Checking
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Run plan check
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded-md border border-[var(--danger)]/40 bg-[rgba(248,113,113,0.08)] p-3 font-mono text-[11px] text-[var(--danger)]">
              {error}
            </div>
          )}
        </CleanCard>

        {result && (
          <>
            <CleanCard className="mt-6 p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                Plan summary
              </div>
              <p className="mt-2 text-[14px] text-[var(--text)]">
                {result.summary || "—"}
              </p>
            </CleanCard>

            <section className="mt-6 space-y-3">
              {result.pitfalls.map((p, i) => (
                <CleanCard key={i} className="p-5">
                  <div className="flex items-start gap-3">
                    <SeverityBadge severity={p.severity} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-[var(--text)]">
                        {p.title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-[1.55] text-[var(--text-dim)]">
                        {p.why}
                      </p>
                      <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          Watch the AI&apos;s output for
                        </div>
                        <div className="mt-1 font-mono text-[12px] text-[var(--cool-2)]">
                          {p.watchFor}
                        </div>
                      </div>
                      <div className="mt-2 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-3">
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                          Add this line to your prompt
                        </div>
                        <div className="mt-1 font-mono text-[12px] text-[var(--text)]">
                          {p.promptHint}
                        </div>
                      </div>
                    </div>
                  </div>
                </CleanCard>
              ))}
            </section>

            <CleanCard className="mt-6 p-5">
              <h3 className="text-[14px] font-semibold text-[var(--text)]">
                Reinforced prompt
              </h3>
              <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
                Your original plan with EDITH&apos;s guardrails appended. Paste
                this into Cursor / Claude Code / Windsurf instead of the bare
                plan.
              </p>
              <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
                <pre className="overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-[1.6] text-[var(--text)]">
                  {reinforcedPrompt}
                </pre>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(reinforcedPrompt);
                }}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
              >
                Copy reinforced prompt
              </button>
            </CleanCard>
          </>
        )}
      </main>
    </>
  );
}
