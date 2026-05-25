"use client";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Terminal,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CleanCard } from "@/components/edith/clean-card";
import { SeverityBadge } from "@/components/edith/severity-badge";
import { Topbar } from "@/components/edith/topbar";

type AttemptResponse = {
  status: number;
  statusText: string;
  url: string;
  method: string;
  durationMs: number;
  bodyText: string;
  headers: Record<string, string>;
  requestBody?: string;
};
type Attempt = {
  probeId: string;
  status: "pass" | "fail" | "skipped" | "error";
  reason?: string;
  requests: AttemptResponse[];
  finding?: {
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    exploitProof: string;
    reproducer: string;
  };
};

type ProbeRun = {
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  endpointsDiscovered: number;
  attempts: Attempt[];
  summary: { passed: number; failed: number; skipped: number; errored: number };
};

export default function RepoProbesPage() {
  const params = useParams<{ repoId: string }>();
  const [baseUrl, setBaseUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ProbeRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRun = async () => {
    if (!baseUrl) {
      setError("Enter a base URL to probe (e.g. https://app.example.com)");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      // We need owner+repo. For now, treat repoId as the repo name and
      // assume the user's GitHub login as the owner — server will resolve.
      const res = await fetch("/api/probes/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The server pulls the user's identity to scope GitHub access;
          // owner is inferred from the session in this v0.
          owner: window.location.pathname.split("/")[2],
          repo: params.repoId,
          baseUrl,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        probeRun?: ProbeRun;
        error?: string;
      };
      if (!json.ok || !json.probeRun) {
        setError(json.error ?? "probe run failed");
      } else {
        setResult(json.probeRun);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Topbar
        title="Runtime probes"
        subtitle="Fire real requests at your deployed app — see what actually fails"
        actions={
          <Link
            href={`/repos/${params.repoId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={1.75} /> Back
          </Link>
        }
      />
      <main className="flex-1 px-6 py-6">
        <CleanCard className="p-5">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">
            Probe target
          </h2>
          <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
            Enter the live URL where this repo is deployed. EDITH will discover
            its API routes from the source, then fire real HTTP requests to
            verify auth, CSRF, webhook signatures, idempotency, headers, and
            XSS reflection. Each finding includes the exact request that proved it.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-app.vercel.app"
              className="h-10 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 font-mono text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-hot)] focus:outline-none"
            />
            <button
              onClick={onRun}
              disabled={running}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  Probing
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
                  Run probes
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
            <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Passed" value={result.summary.passed} tone="good" />
              <Stat label="Failed" value={result.summary.failed} tone="bad" />
              <Stat label="Skipped" value={result.summary.skipped} />
              <Stat label="Errored" value={result.summary.errored} />
            </section>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {result.endpointsDiscovered} endpoints discovered ·{" "}
              {result.durationMs}ms · target {result.baseUrl}
            </p>

            <section className="mt-6 space-y-3">
              {result.attempts.map((a) => (
                <AttemptCard key={a.probeId} a={a} />
              ))}
            </section>
          </>
        )}

        {!result && !running && (
          <CleanCard className="mt-6 p-8 text-center">
            <p className="text-[13px] text-[var(--text-dim)]">
              Enter a base URL above and click Run probes. We&apos;ll discover the
              repo&apos;s API routes and fire 7 live tests in under a minute.
            </p>
          </CleanCard>
        )}
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  return (
    <CleanCard className="p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-[28px] font-semibold leading-none tabular-nums ${
          tone === "good"
            ? "text-[var(--success)]"
            : tone === "bad"
              ? "text-[var(--danger)]"
              : "text-[var(--text)]"
        }`}
      >
        {value}
      </div>
    </CleanCard>
  );
}

function AttemptCard({ a }: { a: Attempt }) {
  const [expanded, setExpanded] = useState(a.status === "fail");
  const tone =
    a.status === "pass"
      ? "good"
      : a.status === "fail"
        ? "bad"
        : a.status === "error"
          ? "warn"
          : "muted";
  const icon =
    a.status === "pass" ? (
      <CheckCircle2
        className="h-4 w-4 text-[var(--success)]"
        strokeWidth={1.75}
      />
    ) : a.status === "fail" ? (
      <XCircle className="h-4 w-4 text-[var(--danger)]" strokeWidth={1.75} />
    ) : a.status === "error" ? (
      <AlertCircle
        className="h-4 w-4 text-[var(--accent)]"
        strokeWidth={1.75}
      />
    ) : (
      <Terminal
        className="h-4 w-4 text-[var(--text-muted)]"
        strokeWidth={1.75}
      />
    );
  return (
    <CleanCard className="p-0" hoverable={false}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--bg-elev-2)]/40"
      >
        {icon}
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] text-[var(--text)]">
            {a.finding?.title ??
              (a.status === "skipped"
                ? `Skipped: ${a.reason ?? a.probeId}`
                : a.status === "error"
                  ? `Probe errored: ${a.reason ?? a.probeId}`
                  : `Probe passed: ${a.probeId}`)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
            {a.probeId}
          </div>
        </div>
        {a.finding && <SeverityBadge severity={a.finding.severity} />}
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
            tone === "good"
              ? "text-[var(--success)]"
              : tone === "bad"
                ? "text-[var(--danger)]"
                : tone === "warn"
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-muted)]"
          }`}
        >
          {a.status}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-[var(--border)] bg-[var(--bg)] px-5 py-4">
          {a.finding && (
            <>
              <p className="text-[13px] leading-[1.6] text-[var(--text-dim)]">
                {a.finding.description}
              </p>
              <div className="mt-3 rounded-md border border-[var(--danger)]/30 bg-[rgba(248,113,113,0.05)] p-3 font-mono text-[12px] leading-[1.55] text-[var(--text)]">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--danger)]">
                  Exploit proof
                </div>
                {a.finding.exploitProof}
              </div>
              <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-3 font-mono text-[11.5px] leading-[1.6] text-[var(--text-dim)]">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Reproducer
                </div>
                <pre className="overflow-auto whitespace-pre-wrap text-[var(--cool-2)]">
                  {a.finding.reproducer}
                </pre>
              </div>
            </>
          )}
          {a.requests.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Requests ({a.requests.length})
              </div>
              {a.requests.map((r, i) => (
                <div
                  key={i}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-3 font-mono text-[11px] text-[var(--text-dim)]"
                >
                  <div className="text-[var(--text)]">
                    {r.method} {r.url} → {r.status} {r.statusText} ·{" "}
                    {r.durationMs}ms
                  </div>
                  {r.requestBody && (
                    <pre className="mt-2 overflow-auto text-[10px] text-[var(--text-muted)]">
                      {r.requestBody}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </CleanCard>
  );
}
