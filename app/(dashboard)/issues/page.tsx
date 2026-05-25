import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Filter, X } from "lucide-react";
import { Topbar } from "@/components/edith/topbar";
import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { MagicCard } from "@/components/spectrum-ui/magic-card";
import { NumberTicker } from "@/components/spectrum-ui/number-ticker";
import { getSupabaseServer } from "@/lib/supabase-server";
import {
  listOpenIssues,
  listOrgRepoNames,
  userOrgId,
} from "@/lib/db-aggregations";
import { timeAgo } from "@/lib/format";
import { RepoFilter } from "@/components/edith/repo-filter";
import type { Severity } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const SEV_STYLE: Record<
  Severity,
  { color: string; bg: string; border: string; rail: string; label: string }
> = {
  critical: {
    color: "text-[var(--danger)]",
    bg: "bg-[rgba(248,113,113,0.08)]",
    border: "border-[rgba(248,113,113,0.40)]",
    rail: "bg-[var(--danger)]",
    label: "Critical",
  },
  high: {
    color: "text-[var(--accent)]",
    bg: "bg-[var(--accent-soft)]",
    border: "border-[var(--accent)]/40",
    rail: "bg-[var(--accent)]",
    label: "High",
  },
  medium: {
    color: "text-[var(--cool-2)]",
    bg: "bg-[rgba(107,174,214,0.08)]",
    border: "border-[rgba(107,174,214,0.40)]",
    rail: "bg-[var(--cool-2)]",
    label: "Medium",
  },
  low: {
    color: "text-[var(--text-dim)]",
    bg: "bg-[var(--bg-elev-2)]",
    border: "border-[var(--border)]",
    rail: "bg-[var(--text-muted)]",
    label: "Low",
  },
};

export default async function IssuesIndex({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; repo?: string }>;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const orgId = await userOrgId(user.id);
  if (!orgId) {
    return (
      <>
        <Topbar title="Issues" subtitle="No org yet" />
        <main className="flex-1 px-6 py-8">
          <SpotlightCard className="p-10 text-center">
            <h2 className="text-[18px] font-semibold text-[var(--text)]">
              Connect a repo first.
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-dim)]">
              EDITH needs something to triage. Head to Repositories.
            </p>
            <Link
              href="/repos"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
            >
              Browse repos <ArrowRight className="h-3 w-3" />
            </Link>
          </SpotlightCard>
        </main>
      </>
    );
  }

  const sp = await searchParams;
  const filterSeverity = SEV_ORDER.includes(sp.severity as Severity)
    ? (sp.severity as Severity)
    : undefined;

  const [all, orgRepos] = await Promise.all([
    listOpenIssues({
      orgId,
      severity: filterSeverity,
      repoName: sp.repo,
      limit: 300,
    }),
    listOrgRepoNames(orgId),
  ]);

  // Always get the *full* counts (unfiltered) for the strip — gives the user
  // the total picture even when they're filtering.
  const everything =
    filterSeverity || sp.repo
      ? await listOpenIssues({ orgId, limit: 300 })
      : all;
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const i of everything) counts[i.severity]++;

  const filterActive = Boolean(filterSeverity || sp.repo);

  return (
    <>
      <Topbar
        title="Issues"
        subtitle={
          filterActive
            ? `${all.length} match · ${everything.length} total`
            : `${all.length} open across your repos`
        }
      />
      <main className="flex-1 px-6 py-8">
        {/* === REPO FILTER === */}
        {orgRepos.length > 0 && (
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Scope
            </div>
            <RepoFilter repos={orgRepos} />
          </div>
        )}

        {/* === SEVERITY STRIP === */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SEV_ORDER.map((sev) => (
            <SevTile
              key={sev}
              sev={sev}
              count={counts[sev]}
              activeFilter={filterSeverity}
              repo={sp.repo}
            />
          ))}
        </div>

        {/* === FILTER BAR === */}
        {(filterActive || all.length > 0) && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              <Filter className="h-3 w-3" strokeWidth={1.75} />
              Filtered
            </div>
            {filterSeverity && (
              <Chip
                label={SEV_STYLE[filterSeverity].label}
                color={SEV_STYLE[filterSeverity].color}
                border={SEV_STYLE[filterSeverity].border}
                bg={SEV_STYLE[filterSeverity].bg}
              />
            )}
            {sp.repo && (
              <Chip
                label={sp.repo}
                color="text-[var(--text)]"
                border="border-[var(--border)]"
                bg="bg-[var(--bg-elev-2)]"
              />
            )}
            {filterActive && (
              <Link
                href="/issues"
                className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)]"
              >
                <X className="h-3 w-3" strokeWidth={2} />
                Clear
              </Link>
            )}
          </div>
        )}

        {/* === LIST === */}
        {all.length === 0 ? (
          <SpotlightCard className="p-12 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--success)]/40 bg-[rgba(74,222,128,0.08)] text-[var(--success)]">
              <AlertTriangle className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold text-[var(--text)]">
              {filterActive ? "No matches." : "Nothing open."}
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-dim)]">
              {filterActive
                ? "Try clearing the filter."
                : "Either you've fixed everything or you haven't scanned anything yet."}
            </p>
          </SpotlightCard>
        ) : (
          <MagicCard className="overflow-hidden">
            <ul className="divide-y divide-[var(--border)]">
              {all.map((i) => (
                <IssueRow
                  key={i.id}
                  id={i.id}
                  scanId={i.scan_id}
                  severity={i.severity}
                  title={i.title}
                  dimension={i.dimension}
                  repoName={i.repo.name}
                  filePath={i.file_path}
                  lineNumber={i.line_number}
                  createdAt={i.created_at}
                />
              ))}
            </ul>
          </MagicCard>
        )}
      </main>
    </>
  );
}

/* ============================== ROWS ============================== */

function IssueRow({
  scanId,
  severity,
  title,
  dimension,
  repoName,
  filePath,
  lineNumber,
  createdAt,
}: {
  id: string;
  scanId: string;
  severity: Severity;
  title: string;
  dimension: string;
  repoName: string;
  filePath: string | null;
  lineNumber: number | null;
  createdAt: string;
}) {
  const sev = SEV_STYLE[severity];
  return (
    <li className="group relative">
      <Link
        href={`/repos/${repoName}/scans/${scanId}`}
        className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--bg-elev-2)]/50"
      >
        {/* severity rail */}
        <span
          aria-hidden
          className={`mt-1 h-4 w-[3px] shrink-0 rounded-full ${sev.rail}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] ${sev.color} ${sev.border} ${sev.bg}`}
            >
              {sev.label}
            </span>
            <span className="text-[13.5px] font-medium text-[var(--text)]">
              {title}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-[var(--text-muted)]">
            <span className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[var(--text-dim)]">
              {repoName}
            </span>
            <span className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 uppercase tracking-[0.15em] text-[var(--text-dim)]">
              {dimension.replace(/_/g, " ")}
            </span>
            {filePath && (
              <span className="truncate">
                {filePath}
                {lineNumber ? `:${lineNumber}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)] sm:flex">
          {timeAgo(createdAt)}
          <ArrowRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
            strokeWidth={2}
          />
        </div>
      </Link>
    </li>
  );
}

function SevTile({
  sev,
  count,
  activeFilter,
  repo,
}: {
  sev: Severity;
  count: number;
  activeFilter?: Severity;
  repo?: string;
}) {
  const active = activeFilter === sev;
  const style = SEV_STYLE[sev];
  const params = new URLSearchParams();
  params.set("severity", sev);
  if (repo) params.set("repo", repo);
  return (
    <Link href={`/issues?${params.toString()}`} className="group block">
      <SpotlightCard
        className={`relative p-5 transition-colors ${active ? style.bg : ""}`}
      >
        {active && (
          <span
            aria-hidden
            className={`absolute left-2 top-2 h-4 w-[2px] ${style.rail}`}
          />
        )}
        <div className="flex items-center justify-between">
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.22em] ${style.color}`}
          >
            {style.label}
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${style.rail}`}
            aria-hidden
          />
        </div>
        <div
          className={`mt-3 font-mono text-[34px] font-semibold leading-none tabular-nums ${
            count > 0 ? "text-[var(--text)]" : "text-[var(--text-muted)]"
          }`}
        >
          <NumberTicker value={count} duration={1200} />
        </div>
        <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          {active ? "filtering" : "click to filter"}
        </div>
      </SpotlightCard>
    </Link>
  );
}

function Chip({
  label,
  color,
  border,
  bg,
}: {
  label: string;
  color: string;
  border: string;
  bg: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${color} ${border} ${bg}`}
    >
      {label}
    </span>
  );
}
