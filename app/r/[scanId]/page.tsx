/**
 * Public read-only scan page. Anyone with the URL can view the report —
 * no sign-in required. The UUID scanId is the share token (unguessable).
 *
 * What's visible:
 *   - Scores (EDITH / Test / Debt + dimension breakdown)
 *   - Issues by dimension, with severity + file:line
 *   - Total issue counts
 *
 * What's hidden:
 *   - Fix prompts (paid feature; teaser only)
 *   - Code snippets longer than 80 chars (avoid leaking the user's source)
 *   - Commit message
 */
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CleanCard } from "@/components/edith/clean-card";
import { DimIcon } from "@/components/edith/dim-icon";
import { ScorePill } from "@/components/edith/score-pill";
import { SeverityBadge } from "@/components/edith/severity-badge";
import { EdithLogo } from "@/components/edith/logo";
import { dbGetScan } from "@/lib/db";
import { DIMENSION_LABELS, type Dimension, type Issue } from "@/lib/mock-data";
import { formatDuration, scoreColor, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PublicScanPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const scan = await dbGetScan(scanId);
  if (!scan) notFound();

  const dims = Object.keys(DIMENSION_LABELS) as Dimension[];
  const grouped = dims.reduce<Record<Dimension, Issue[]>>(
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
    <div className="min-h-svh bg-[var(--bg)]">
      {/* Public navbar */}
      <header className="border-b border-[var(--border)]/60 bg-[var(--bg-elev)]/30 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="text-[var(--text)]">
            <EdithLogo />
          </Link>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
            <span className="text-[var(--text-muted)]">
              public scan · read-only
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[var(--bg)] hover:brightness-110"
            >
              Try EDITH on yours <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Hero */}
        <section>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            EDITH report
          </div>
          <h1 className="mt-2 text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--text)]">
            {scan.issues.length === 0
              ? "Clean scan. Nothing to flag."
              : `${scan.issues.length} ${scan.issues.length === 1 ? "issue" : "issues"} caught on ${scan.commit}`}
          </h1>
          <p className="mt-2 font-mono text-[11px] text-[var(--text-muted)]">
            {scan.branch} · {timeAgo(scan.startedAt)} ·{" "}
            {formatDuration(scan.durationMs)}
          </p>
        </section>

        {/* Three scores */}
        <section className="mt-8 grid gap-3 md:grid-cols-3">
          <ScoreBlock label="EDITH" value={scan.scoreEdith} />
          <ScoreBlock label="Test" value={scan.scoreTest} />
          <ScoreBlock label="Debt" value={scan.scoreDebt} />
        </section>

        {/* Dimension breakdown */}
        <CleanCard className="mt-6 p-0">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              Dimension breakdown
            </h2>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {dims.map((d) => {
              const score = scan.dimensionScores[d];
              return (
                <li key={d} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)]">
                    <DimIcon dim={d} className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                  </div>
                  <div className="w-36 shrink-0 text-[13px] text-[var(--text)]">
                    {DIMENSION_LABELS[d]}
                  </div>
                  <div className="flex flex-1 items-center gap-3">
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${score}%`, background: scoreColor(score) }}
                      />
                    </div>
                    <span
                      className="w-12 text-right font-mono text-[12px] font-semibold tabular-nums"
                      style={{ color: scoreColor(score) }}
                    >
                      {score}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </CleanCard>

        {/* Issues grouped by dimension */}
        <section className="mt-6 space-y-4">
          {dims.map((d) => {
            const issues = grouped[d];
            if (issues.length === 0) return null;
            return (
              <CleanCard key={d} className="p-0">
                <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
                  <DimIcon dim={d} className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <h2 className="text-[15px] font-semibold text-[var(--text)]">
                    {DIMENSION_LABELS[d]}
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {issues.length} {issues.length === 1 ? "issue" : "issues"}
                  </span>
                  <ScorePill
                    score={scan.dimensionScores[d]}
                    size="sm"
                    className="ml-auto"
                  />
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {issues.map((issue) => (
                    <li
                      key={issue.id}
                      className="flex items-start gap-3 px-5 py-3.5"
                    >
                      <SeverityBadge severity={issue.severity} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] text-[var(--text)]">
                          {issue.title}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-muted)]">
                          {issue.file}
                          {issue.line ? `:${issue.line}` : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CleanCard>
            );
          })}

          {scan.issues.length === 0 && (
            <CleanCard className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(74,222,128,0.12)]">
                <Check
                  className="h-6 w-6 text-[var(--success)]"
                  strokeWidth={2}
                />
              </div>
              <h2 className="mt-4 text-[20px] font-semibold text-[var(--text)]">
                Nothing to flag.
              </h2>
              <p className="mt-2 text-[13.5px] text-[var(--text-dim)]">
                All EDITH checks ran cleanly on this commit.
              </p>
            </CleanCard>
          )}
        </section>

        {/* CTA */}
        <CleanCard className="mt-8 p-7 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            Like what you see?
          </div>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            Run EDITH on your own repos.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[14px] text-[var(--text-dim)]">
            30 checks across 6 dimensions, fix prompts for Cursor / Claude
            Code, auto-PR-review. Two minutes to set up. Free tier covers one
            repo.
          </p>
          <div className="mt-5">
            <Link
              href="/signin"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
            >
              Connect GitHub <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </CleanCard>

        <footer className="mt-12 flex items-center justify-between border-t border-[var(--border)] pt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <span>EDITH · scan {scan.commit}</span>
          <Link href="/" className="hover:text-[var(--text)]">
            edith.expert
          </Link>
        </footer>
      </main>
    </div>
  );
}

function ScoreBlock({ label, value }: { label: string; value: number }) {
  return (
    <CleanCard className="p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className="mt-2 font-mono text-[48px] font-semibold leading-none tabular-nums"
        style={{ color: scoreColor(value) }}
      >
        {value}
        <span className="text-[18px] text-[var(--text-muted)]">/100</span>
      </div>
    </CleanCard>
  );
}
