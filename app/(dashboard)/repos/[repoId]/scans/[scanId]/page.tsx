"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  GitBranch,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
// useEffect is used inside IssueRow below for lazy fix-prompt fetch.
import { CleanCard } from "@/components/edith/clean-card";
import { DimIcon } from "@/components/edith/dim-icon";
import { ScorePill } from "@/components/edith/score-pill";
import { SeverityBadge } from "@/components/edith/severity-badge";
import { Topbar } from "@/components/edith/topbar";
import {
  DIMENSION_LABELS,
  type Dimension,
  type Issue,
  type Scan,
} from "@/lib/mock-data";
import { formatDuration, scoreColor, timeAgo } from "@/lib/format";

export default function ScanDetailPage() {
  const params = useParams<{ repoId: string; scanId: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/scans/${params.scanId}`);
        if (!res.ok) {
          if (!cancelled) {
            setError(`Scan not found (${res.status})`);
            setLoading(false);
          }
          return;
        }
        const json = (await res.json()) as { scan: Scan };
        if (!cancelled) {
          setScan(json.scan);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.scanId]);

  if (loading) {
    return (
      <>
        <Topbar title="Loading scan…" subtitle={params.scanId} />
        <main className="flex-1 px-6 py-6">
          <CleanCard className="p-10 text-center text-[13px] text-[var(--text-dim)]">
            Fetching scan from Supabase…
          </CleanCard>
        </main>
      </>
    );
  }

  if (error || !scan) {
    return (
      <>
        <Topbar title="Scan not found" subtitle={params.scanId} />
        <main className="flex-1 px-6 py-6">
          <CleanCard className="p-10 text-center">
            <h2 className="text-[16px] font-semibold text-[var(--text)]">
              {error ?? "Scan not found"}
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-dim)]">
              The scan may still be running, or the migration may not be
              applied. Check the dashboard for the latest scan.
            </p>
            <Link
              href={`/repos/${params.repoId}`}
              className="mt-5 inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]"
            >
              <ArrowLeft className="h-3 w-3" strokeWidth={1.75} /> Back to repo
            </Link>
          </CleanCard>
        </main>
      </>
    );
  }

  const dims = Object.keys(DIMENSION_LABELS) as Dimension[];
  const issuesByDim = dims.reduce<Record<Dimension, Issue[]>>(
    (acc, d) => {
      acc[d] = scan.issues.filter((i) => i.dimension === d);
      return acc;
    },
    {
      security: [],
      performance: [],
      reliability: [],
      data_safety: [],
      business_logic: [],
      deploy_readiness: [],
      ai_surface: [],
      accessibility: [],
      dependencies: [],
      seo: [],
    },
  );

  return (
    <>
      <Topbar
        title={`Scan · ${scan.commit}`}
        subtitle={`${scan.branch} · ${timeAgo(scan.startedAt)} · ${formatDuration(scan.durationMs)}`}
        actions={
          <>
            <ShareButton scanId={scan.id} />
            <Link
              href={`/repos/${params.repoId}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]"
            >
              <ArrowLeft className="h-3 w-3" strokeWidth={1.75} /> Back
            </Link>
          </>
        }
      />
      <main className="flex-1 px-6 py-6">
        <section className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_2fr]">
          <ScoreBlock label="EDITH" value={scan.scoreEdith} />
          <ScoreBlock label="Test" value={scan.scoreTest} />
          <ScoreBlock label="Debt" value={scan.scoreDebt} />
          <CleanCard className="p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Commit
            </div>
            <div className="mt-2 flex items-center gap-2 font-mono text-[13px] text-[var(--text)]">
              <GitBranch
                className="h-3.5 w-3.5 text-[var(--text-dim)]"
                strokeWidth={1.75}
              />
              {scan.branch}
              <span className="text-[var(--text-muted)]">·</span>
              {scan.commit}
            </div>
            {scan.commitMessage && (
              <p className="mt-2 text-[13px] text-[var(--text-dim)]">
                {scan.commitMessage}
              </p>
            )}
            <div className="mt-3 flex gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <span>{formatDuration(scan.durationMs)} scan</span>
              <span>·</span>
              <span>
                {scan.issues.length}{" "}
                {scan.issues.length === 1 ? "issue" : "issues"}
              </span>
            </div>
          </CleanCard>
        </section>

        <section className="mt-6 space-y-4">
          {dims.map((d) => {
            const issues = issuesByDim[d];
            if (issues.length === 0) return null;
            return (
              <DimensionGroup
                key={d}
                dim={d}
                dimScore={scan.dimensionScores[d]}
                issues={issues}
              />
            );
          })}
          {scan.issues.length === 0 && (
            <CleanCard className="p-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(74,222,128,0.12)]">
                <Check
                  className="h-5 w-5 text-[var(--success)]"
                  strokeWidth={2}
                />
              </div>
              <h3 className="mt-3 text-[15px] font-semibold text-[var(--text)]">
                Nothing to flag.
              </h3>
              <p className="mt-1 text-[13px] text-[var(--text-dim)]">
                All 8 v0 checks ran cleanly on this commit.
              </p>
            </CleanCard>
          )}
        </section>
      </main>
    </>
  );
}

function ShareButton({ scanId }: { scanId: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const url = `${window.location.origin}/r/${scanId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(url, "_blank");
    }
  };
  return (
    <button
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" strokeWidth={2.5} />
          Copied
        </>
      ) : (
        <>
          <Share2 className="h-3 w-3" strokeWidth={1.75} />
          Share scan
        </>
      )}
    </button>
  );
}

function ScoreBlock({ label, value }: { label: string; value: number }) {
  return (
    <CleanCard className="p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className="mt-2 font-mono text-[36px] font-semibold leading-none tabular-nums"
        style={{ color: scoreColor(value) }}
      >
        {value}
      </div>
    </CleanCard>
  );
}

function DimensionGroup({
  dim,
  dimScore,
  issues,
}: {
  dim: Dimension;
  dimScore: number;
  issues: Issue[];
}) {
  return (
    <CleanCard className="p-0">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)]">
          <DimIcon dim={dim} className="h-3.5 w-3.5 text-[var(--text-dim)]" />
        </div>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">
          {DIMENSION_LABELS[dim]}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {issues.length} {issues.length === 1 ? "issue" : "issues"}
        </span>
        <ScorePill score={dimScore} size="sm" className="ml-auto" />
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </ul>
    </CleanCard>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [tool, setTool] = useState<"cursor" | "claude_code" | "windsurf" | "v0">(
    "cursor",
  );
  const [test, setTest] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testCopied, setTestCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  // Lazy-fetch the fix prompt the first time the row is opened.
  // NB: do NOT include `promptLoading` in deps — setting it would re-run the
  // effect and cancel the in-flight fetch before the response arrives.
  useEffect(() => {
    if (!open || prompt !== null) return;
    let cancelled = false;
    setPromptLoading(true);
    setPromptError(null);
    (async () => {
      try {
        const res = await fetch(`/api/fix-prompts/${issue.id}?tool=${tool}`);
        const json = (await res.json()) as {
          ok: boolean;
          prompt?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!json.ok || !json.prompt) {
          setPromptError(json.error ?? "Failed to load fix prompt");
        } else {
          setPrompt(json.prompt);
        }
      } catch (e) {
        if (!cancelled) {
          setPromptError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setPromptLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prompt, issue.id, tool]);

  // When the user switches tool, reset the prompt to force a refetch.
  const onToolChange = (next: typeof tool) => {
    setTool(next);
    setPrompt(null);
    setPromptError(null);
  };

  const copyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const genTest = async () => {
    if (test || testLoading) return;
    setTestLoading(true);
    try {
      const res = await fetch(`/api/test-gen/${issue.id}`);
      const json = (await res.json()) as { ok: boolean; test?: string };
      if (json.ok && json.test) setTest(json.test);
    } finally {
      setTestLoading(false);
    }
  };

  const copyTest = async () => {
    if (!test) return;
    try {
      await navigator.clipboard.writeText(test);
      setTestCopied(true);
      setTimeout(() => setTestCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const dismiss = async (scope: "user" | "repo" | "org") => {
    if (dismissing || dismissed) return;
    setDismissing(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (res.ok) setDismissed(true);
    } finally {
      setDismissing(false);
    }
  };

  const TOOL_LABEL: Record<typeof tool, string> = {
    cursor: "Cursor",
    claude_code: "Claude Code",
    windsurf: "Windsurf",
    v0: "v0",
  };

  return (
    <li className={dismissed ? "opacity-40" : ""}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--bg-elev-2)]/40"
      >
        <SeverityBadge severity={issue.severity} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] text-[var(--text)]">{issue.title}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-muted)]">
            {issue.file}
            {issue.line ? `:${issue.line}` : ""}
          </div>
        </div>
        {dismissed && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Dismissed
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--bg)] px-5 py-4">
          <p className="text-[13px] leading-[1.6] text-[var(--text-dim)]">
            {issue.description || "(no description)"}
          </p>
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Fix prompt ·
                </span>
                <div className="flex items-center gap-1">
                  {(["cursor", "claude_code", "windsurf", "v0"] as const).map(
                    (t) => (
                      <button
                        key={t}
                        onClick={() => onToolChange(t)}
                        className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] transition-colors ${
                          tool === t
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                      >
                        {TOOL_LABEL[t]}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <button
                onClick={copyPrompt}
                disabled={!prompt}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[var(--accent)] px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" strokeWidth={2.5} /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" strokeWidth={2.25} /> Copy
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-auto whitespace-pre-wrap p-3 font-mono text-[11.5px] leading-[1.6] text-[var(--text-dim)]">
              {promptLoading
                ? "Generating fix prompt…"
                : promptError
                  ? `Failed to load prompt: ${promptError}`
                  : (prompt ?? "")}
            </pre>
          </div>
          {/* Auto-generated regression test */}
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Regression test {test ? "· vitest" : ""}
              </span>
              {test ? (
                <button
                  onClick={copyTest}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[var(--accent)] px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
                >
                  {testCopied ? (
                    <><Check className="h-3 w-3" strokeWidth={2.5} /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" strokeWidth={2.25} /> Copy test</>
                  )}
                </button>
              ) : (
                <button
                  onClick={genTest}
                  disabled={testLoading}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110 disabled:opacity-50"
                >
                  {testLoading ? "Generating…" : "Generate test"}
                </button>
              )}
            </div>
            {test && (
              <pre className="overflow-auto whitespace-pre-wrap p-3 font-mono text-[11.5px] leading-[1.6] text-[var(--text-dim)]">
                {test}
              </pre>
            )}
          </div>

          {/* Dismiss menu */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Not actually a bug?
            </span>
            <button
              onClick={() => dismiss("user")}
              disabled={dismissing || dismissed}
              className="rounded border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)] disabled:opacity-40"
            >
              Hide for me
            </button>
            <button
              onClick={() => dismiss("repo")}
              disabled={dismissing || dismissed}
              className="rounded border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)] disabled:opacity-40"
            >
              Hide on this repo
            </button>
            <button
              onClick={() => dismiss("org")}
              disabled={dismissing || dismissed}
              className="rounded border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)] disabled:opacity-40"
            >
              Hide for everyone
            </button>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              5 dismissals silences this check
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
