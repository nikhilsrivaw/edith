import {
  ArrowRight,
  ExternalLink,
  GitBranch,
  Lock,
  Settings,
  Star,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CleanCard } from "@/components/edith/clean-card";
import { DimIcon } from "@/components/edith/dim-icon";
import { ScanButton } from "@/components/edith/scan-button";
import { ScorePill } from "@/components/edith/score-pill";
import { SeverityBadge } from "@/components/edith/severity-badge";
import { Topbar } from "@/components/edith/topbar";
import { getSupabaseServer } from "@/lib/supabase-server";
import { fetchGithubUser } from "@/lib/github-fetch";
import { dbGetRepoByName, dbGetScansForRepo } from "@/lib/db";
import { getScoreTrend, getOpenDriftAlerts } from "@/lib/drift";
import {
  DIMENSION_LABELS,
  type Dimension,
} from "@/lib/mock-data";
import { formatDuration, scoreColor, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type GhRepoFull = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  topics: string[];
  owner: { login: string; avatar_url: string };
};

async function fetchGhRepo(
  token: string,
  owner: string,
  repo: string,
): Promise<GhRepoFull | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "edith-app",
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json() as Promise<GhRepoFull>;
}

export default async function RepoPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const { repoId } = await params;
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.provider_token) redirect("/signin");

  const ghUser = await fetchGithubUser();
  if (!ghUser) notFound();

  const ghRepo = await fetchGhRepo(
    session.provider_token,
    ghUser.login,
    repoId,
  );
  if (!ghRepo) notFound();

  // DB lookup is optional — repo may not be in our DB yet.
  const dbRepo = await dbGetRepoByName({
    owner: ghRepo.owner.login,
    name: ghRepo.name,
  });
  const scans = dbRepo ? await dbGetScansForRepo(dbRepo.id) : [];
  const latest = scans[0];
  const dims = Object.keys(DIMENSION_LABELS) as Dimension[];
  const trend = dbRepo ? await getScoreTrend(dbRepo.id, 20) : [];
  const driftAlerts = dbRepo ? await getOpenDriftAlerts(dbRepo.id) : [];

  return (
    <>
      <Topbar
        title={`${ghRepo.owner.login}/${ghRepo.name}`}
        subtitle={ghRepo.description ?? "(no description)"}
        actions={
          <>
            <Link
              href={ghRepo.html_url}
              target="_blank"
              rel="noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
              GitHub
            </Link>
            <Link
              href={`/repos/${ghRepo.name}/probes`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110"
            >
              Runtime probes
            </Link>
            <Link
              href={`/repos/${ghRepo.name}/settings`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]"
            >
              <Settings className="h-3 w-3" strokeWidth={1.75} /> Settings
            </Link>
            <ScanButton owner={ghRepo.owner.login} repo={ghRepo.name} />
          </>
        }
      />

      <main className="flex-1 px-6 py-6">
        {/* GitHub facts row */}
        <CleanCard className="p-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Fact label="Branch" value={ghRepo.default_branch} icon={GitBranch} />
            <Fact
              label="Visibility"
              value={ghRepo.private ? "Private" : "Public"}
              icon={ghRepo.private ? Lock : undefined}
            />
            <Fact label="Language" value={ghRepo.language ?? "—"} />
            <Fact
              label="Stars"
              value={ghRepo.stargazers_count.toString()}
              icon={Star}
            />
            <Fact label="Pushed" value={timeAgo(ghRepo.pushed_at)} />
          </div>
        </CleanCard>

        {/* If no scans yet, big empty state */}
        {scans.length === 0 ? (
          <CleanCard className="mt-6 p-10 text-center">
            <div className="mx-auto max-w-md">
              <h2 className="text-[20px] font-semibold text-[var(--text)]">
                Never scanned yet.
              </h2>
              <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
                Hit Scan to run all 8 v0 checks on the current{" "}
                <span className="font-mono text-[12px] text-[var(--text)]">
                  {ghRepo.default_branch}
                </span>{" "}
                commit. Takes a few seconds.
              </p>
              <div className="mt-6 flex justify-center">
                <ScanButton owner={ghRepo.owner.login} repo={ghRepo.name} />
              </div>
            </div>
          </CleanCard>
        ) : (
          <>
            {/* Three scores */}
            {latest && (
              <section className="mt-6 grid gap-3 md:grid-cols-3">
                <ScoreCard
                  label="EDITH Score"
                  value={latest.scoreEdith}
                  hint="weighted across 6 dimensions"
                />
                <ScoreCard
                  label="Test Score"
                  value={latest.scoreTest}
                  hint="run rate of critical-issue regression tests"
                />
                <ScoreCard
                  label="Debt Score"
                  value={latest.scoreDebt}
                  hint="lower = more technical debt"
                />
              </section>
            )}

            {/* Drift alerts */}
            {driftAlerts.length > 0 && <DriftAlertsCard alerts={driftAlerts} />}

            {/* Score trend chart */}
            {trend.length > 1 && <TrendCard points={trend} />}

            {/* Dimension breakdown */}
            {latest && (
              <CleanCard className="mt-6 p-0">
                <div className="border-b border-[var(--border)] px-5 py-4">
                  <h2 className="text-[15px] font-semibold text-[var(--text)]">
                    Dimension breakdown
                  </h2>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Latest scan · {latest.commit}
                  </div>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {dims.map((d) => {
                    const score = latest.dimensionScores[d];
                    return (
                      <li
                        key={d}
                        className="flex items-center gap-4 px-5 py-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)]">
                          <DimIcon
                            dim={d}
                            className="h-3.5 w-3.5 text-[var(--text-dim)]"
                          />
                        </div>
                        <div className="w-32 shrink-0 text-[13px] text-[var(--text)]">
                          {DIMENSION_LABELS[d]}
                        </div>
                        <div className="flex flex-1 items-center gap-3">
                          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                            <span
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{
                                width: `${score}%`,
                                background: scoreColor(score),
                              }}
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
            )}

            {/* Scan history */}
            <CleanCard className="mt-6 p-0">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                <h2 className="text-[15px] font-semibold text-[var(--text)]">
                  Scan history
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {scans.length} {scans.length === 1 ? "scan" : "scans"}
                </span>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    <th className="px-5 py-3">When</th>
                    <th className="px-3 py-3">Commit</th>
                    <th className="px-3 py-3">Branch</th>
                    <th className="px-3 py-3">Score</th>
                    <th className="px-3 py-3">Issues</th>
                    <th className="px-3 py-3 text-right">Duration</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {scans.map((s) => {
                    const critical = s.issues.filter(
                      (i) => i.severity === "critical",
                    ).length;
                    return (
                      <tr
                        key={s.id}
                        className="transition-colors hover:bg-[var(--bg-elev-2)]/40"
                      >
                        <td className="px-5 py-3.5 font-mono text-[11px] text-[var(--text-dim)]">
                          {timeAgo(s.startedAt)}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="font-mono text-[11px] text-[var(--text)]">
                            {s.commit}
                          </div>
                          {s.commitMessage && (
                            <div className="mt-0.5 max-w-xs truncate font-mono text-[10px] text-[var(--text-muted)]">
                              {s.commitMessage}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-dim)]">
                            <GitBranch
                              className="h-3 w-3"
                              strokeWidth={1.75}
                            />
                            {s.branch}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <ScorePill score={s.scoreEdith} size="sm" />
                        </td>
                        <td className="px-3 py-3.5 font-mono text-[11px]">
                          <span className="text-[var(--text)]">
                            {s.issues.length}
                          </span>
                          {critical > 0 && (
                            <span className="ml-2">
                              <SeverityBadge severity="critical" />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] text-[var(--text-dim)]">
                          {formatDuration(s.durationMs)}
                        </td>
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/repos/${ghRepo.name}/scans/${s.id}`}
                            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110"
                          >
                            Open <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CleanCard>
          </>
        )}
      </main>
    </>
  );
}

type DriftAlertRow = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  created_at: string;
};

function DriftAlertsCard({ alerts }: { alerts: DriftAlertRow[] }) {
  return (
    <CleanCard className="mt-6 p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">
            Open drift alerts
          </h2>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Things that got worse since the last scan
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
          {alerts.length} open
        </span>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {alerts.slice(0, 8).map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-5 py-3">
            <span
              className={`h-1.5 w-1.5 rounded-sm ${
                a.severity === "critical"
                  ? "bg-[var(--danger)]"
                  : a.severity === "high"
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--cool-2)]"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-[var(--text)]">{a.title}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {a.kind.replace("_", " ")} · {timeAgo(a.created_at)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </CleanCard>
  );
}

function TrendCard({
  points,
}: {
  points: Array<{ scanId: string; score: number; commit: string; startedAt: string }>;
}) {
  const W = 720;
  const H = 100;
  const min = Math.max(0, Math.min(...points.map((p) => p.score)) - 5);
  const max = Math.min(100, Math.max(...points.map((p) => p.score)) + 5);
  const range = Math.max(1, max - min);
  const step = W / (points.length - 1 || 1);
  const path =
    "M " +
    points
      .map((p, i) => `${(i * step).toFixed(1)},${(H - ((p.score - min) / range) * H).toFixed(1)}`)
      .join(" L ");
  return (
    <CleanCard className="mt-6 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">
            Score trend
          </h2>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Last {points.length} scans
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {points[0].score} → {points[points.length - 1].score}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 h-24 w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L ${W},${H} L 0,${H} Z`} fill="url(#trend-fill)" />
        <path
          d={path}
          stroke="var(--accent)"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.scanId}
            cx={i * step}
            cy={H - ((p.score - min) / range) * H}
            r={2}
            fill="var(--accent)"
          />
        ))}
      </svg>
    </CleanCard>
  );
}

function ScoreCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <CleanCard className="p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className="mt-3 font-mono text-[42px] font-semibold leading-none tabular-nums"
        style={{ color: scoreColor(value) }}
      >
        {value}
        <span className="text-[18px] text-[var(--text-muted)]">/100</span>
      </div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {hint}
      </div>
    </CleanCard>
  );
}

function Fact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--text)]">
        {Icon && (
          <Icon
            className="h-3.5 w-3.5 text-[var(--text-dim)]"
            strokeWidth={1.75}
          />
        )}
        {value}
      </div>
    </div>
  );
}
